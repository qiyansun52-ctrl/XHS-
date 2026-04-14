#!/usr/bin/env python3
"""
XHS Dashboard 爬虫后台服务

工作方式：
  - 每 5 秒轮询 Supabase，处理 fetch_status='pending' 的任务
  - 每 12 小时全量刷新所有已抓取记录的数据
  - macOS LaunchAgent 开机自动启动，无需手动操作

任务类型：
  - viral_posts：爆款收藏帖子抓取（标题/封面/互动数据）
  - benchmark_accounts：对标账号抓取（账号信息 + 最近10条帖子）
  - topics：选题库参考帖子数据更新
"""

import asyncio
import os
import sys
import logging
import re
import uuid
import httpx
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

# ── 路径配置 ─────────────────────────────────────────────────────────
MEDIACRAWLER_DIR = "/Users/gabriel/MediaCrawler"
CRAWLER_DIR = os.path.dirname(os.path.abspath(__file__))

sys.path.insert(0, MEDIACRAWLER_DIR)
os.chdir(MEDIACRAWLER_DIR)

# ── 日志配置 ─────────────────────────────────────────────────────────
os.makedirs(os.path.join(CRAWLER_DIR, "logs"), exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(CRAWLER_DIR, "logs", "server.log"), encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)

# ── 延迟导入（需要在 chdir 之后）───────────────────────────────────────
from playwright.async_api import async_playwright, BrowserContext, Page
from supabase import create_client, Client
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from media_platform.xhs.client import XiaoHongShuClient
from media_platform.xhs.help import parse_note_info_from_note_url, parse_creator_info_from_url
from tools.utils import utils
import config as mc_config  # MediaCrawler config

# ── Supabase ──────────────────────────────────────────────────────────
SUPABASE_URL = "https://nlsgqlkqimedgftkmzxn.supabase.co"
SUPABASE_KEY = "sb_publishable_tyupNEK3brVkdIUFkYl8Lw_glvGpbbb"
sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── 全局状态 ──────────────────────────────────────────────────────────
xhs_client: Optional[XiaoHongShuClient] = None
browser_ctx: Optional[BrowserContext] = None
ctx_page: Optional[Page] = None
playwright_inst = None
client_ready = False


# ── 工具函数 ──────────────────────────────────────────────────────────

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_count(value) -> int:
    """解析小红书数字字符串 '1.2万' → 12000"""
    if value is None:
        return 0
    s = str(value).strip().replace(",", "").replace("+", "").replace(" ", "")
    if not s or s == "-":
        return 0
    try:
        if "万" in s:
            return int(float(s.replace("万", "")) * 10000)
        if "k" in s.lower():
            return int(float(s.lower().replace("k", "")) * 1000)
        return int(float(s))
    except (ValueError, TypeError):
        nums = re.findall(r"\d+\.?\d*", s)
        return int(float(nums[0])) if nums else 0


async def upload_cover_image(xhs_cdn_url: str, folder: str = "covers") -> str:
    """下载 XHS CDN 图片并上传到 Supabase Storage，返回公开 URL"""
    if not xhs_cdn_url:
        return ""
    try:
        # 强制 https
        dl_url = xhs_cdn_url.replace("http://", "https://")
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(dl_url, headers={
                "Referer": "https://www.xiaohongshu.com/",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            })
            if resp.status_code != 200:
                return ""
            img_bytes = resp.content
            content_type = resp.headers.get("content-type", "image/webp")

        ext = "jpg" if "jpeg" in content_type or "jpg" in content_type else "webp"
        filename = f"{folder}/{uuid.uuid4().hex}.{ext}"

        sb.storage.from_("post-images").upload(
            path=filename,
            file=img_bytes,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        public_url = sb.storage.from_("post-images").get_public_url(filename)
        return public_url
    except Exception as e:
        log.warning(f"封面图上传失败: {e}")
        return ""


async def resolve_url(url: str) -> str:
    """解析短链接 xhslink.com → 完整 URL"""
    if "xhslink.com" not in url:
        return url
    import httpx
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15"
            })
            return str(resp.url)
    except Exception as e:
        log.warning(f"短链解析失败: {e}")
        return url


# ── XHS 客户端初始化 ──────────────────────────────────────────────────

async def init_xhs_client() -> bool:
    """初始化 Playwright 浏览器 + XHS 客户端（复用已保存的登录态）"""
    global xhs_client, browser_ctx, ctx_page, playwright_inst, client_ready

    log.info("初始化 XHS 客户端（使用已保存的登录态）...")
    try:
        playwright_inst = await async_playwright().start()
        chromium = playwright_inst.chromium

        user_data_dir = os.path.join(MEDIACRAWLER_DIR, "browser_data", "xhs_user_data_dir")
        browser_ctx = await chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            accept_downloads=True,
            headless=True,
            viewport={"width": 1920, "height": 1080},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
            ),
        )

        stealth_js = os.path.join(MEDIACRAWLER_DIR, "libs", "stealth.min.js")
        if os.path.exists(stealth_js):
            await browser_ctx.add_init_script(path=stealth_js)

        ctx_page = await browser_ctx.new_page()
        try:
            await ctx_page.goto("https://www.xiaohongshu.com", timeout=60000, wait_until="domcontentloaded")
        except Exception:
            # 页面加载超时不影响 Cookie 的使用，继续初始化
            pass

        cookie_str, cookie_dict = utils.convert_cookies(await browser_ctx.cookies())
        xhs_client = XiaoHongShuClient(
            proxy=None,
            headers={
                "accept": "application/json, text/plain, */*",
                "accept-language": "zh-CN,zh;q=0.9",
                "content-type": "application/json;charset=UTF-8",
                "origin": "https://www.xiaohongshu.com",
                "referer": "https://www.xiaohongshu.com/",
                "user-agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
                ),
                "Cookie": cookie_str,
            },
            playwright_page=ctx_page,
            cookie_dict=cookie_dict,
            proxy_ip_pool=None,
        )

        if await xhs_client.pong():
            log.info("✅ XHS 客户端初始化成功，登录状态正常")
            client_ready = True
            return True
        else:
            log.warning("⚠️  XHS 登录状态失效，请重新扫码：cd /Users/gabriel/MediaCrawler && .venv/bin/python main.py --platform xhs --lt qrcode --type creator")
            client_ready = False
            return False

    except Exception as e:
        log.error(f"❌ XHS 客户端初始化失败: {e}")
        client_ready = False
        return False


# ── 爬取功能 ──────────────────────────────────────────────────────────

async def fetch_post_data(url: str) -> Dict[str, Any]:
    """抓取帖子数据：标题 / 封面 / 互动数据"""
    url = await resolve_url(url)

    # 提取 note_id 和 xsec_token
    note_info = parse_note_info_from_note_url(url)
    note_id = note_info.note_id
    xsec_token = note_info.xsec_token
    xsec_source = note_info.xsec_source or "pc_feed"

    if not note_id:
        raise ValueError(f"无法从 URL 解析帖子 ID: {url}")

    note_data = await xhs_client.get_note_by_id(
        note_id=note_id,
        xsec_source=xsec_source,
        xsec_token=xsec_token,
    )

    if not note_data:
        raise ValueError(f"帖子数据为空（可能触发风控）: {note_id}")

    interact = note_data.get("interact_info", {})
    images = note_data.get("image_list", [])
    raw_cover = images[0].get("url_default", "") if images else ""
    cover = await upload_cover_image(raw_cover) if raw_cover else ""

    return {
        "xhs_note_id":  note_id,
        "title":        note_data.get("title", "").strip(),
        "cover_image":  cover,
        "likes":        parse_count(interact.get("liked_count")),
        "saves":        parse_count(interact.get("collected_count")),
        "comments":     parse_count(interact.get("comment_count")),
        "views":        parse_count(interact.get("view_count")),
        "author_name":  note_data.get("user", {}).get("nickname", ""),
        "fetch_status": "done",
        "fetched_at":   now_iso(),
    }


async def fetch_account_data(url: str) -> Dict[str, Any]:
    """抓取账号信息 + 最近10条帖子"""
    url = await resolve_url(url)

    creator_info = parse_creator_info_from_url(url)
    user_id = creator_info.user_id
    xsec_token = creator_info.xsec_token
    xsec_source = creator_info.xsec_source or "app_share"

    if not user_id:
        raise ValueError(f"无法解析账号 ID: {url}")

    # 获取账号基本信息
    account_data = await xhs_client.get_creator_info(
        user_id=user_id,
        xsec_token=xsec_token,
        xsec_source=xsec_source,
    )
    if not account_data:
        raise ValueError(f"账号数据为空: {user_id}")

    # 获取最近帖子列表（概要数据，无需逐条 detail 请求）
    recent_posts: List[Dict] = []
    try:
        # 临时将 MAX_NOTES 设为 10
        original_max = mc_config.CRAWLER_MAX_NOTES_COUNT
        mc_config.CRAWLER_MAX_NOTES_COUNT = 10

        note_summaries = await xhs_client.get_all_notes_by_creator(
            user_id=user_id,
            crawl_interval=1,
            callback=None,
            xsec_token=xsec_token,
            xsec_source=xsec_source,
        )
        mc_config.CRAWLER_MAX_NOTES_COUNT = original_max

        for note in note_summaries[:10]:
            cover_info = note.get("cover", {}) or {}
            raw_cover = cover_info.get("url_default", cover_info.get("url", ""))
            cover = await upload_cover_image(raw_cover, folder="benchmark-covers") if raw_cover else ""
            recent_posts.append({
                "note_id":     note.get("note_id", ""),
                "title":       note.get("display_title", note.get("title", "")),
                "cover_image": cover,
                "likes":       parse_count(note.get("interact_info", {}).get("liked_count")),
                "saves":       parse_count(note.get("interact_info", {}).get("collected_count")),
                "xsec_token":  note.get("xsec_token", ""),
            })
    except Exception as e:
        log.warning(f"获取最近帖子失败: {e}")

    return {
        "xhs_user_id":  user_id,
        "name":         account_data.get("nickname", ""),
        "avatar_url":   account_data.get("avatar", ""),
        "bio":          account_data.get("desc", ""),
        "followers":    parse_count(account_data.get("fans")),
        "recent_posts": recent_posts,
        "fetch_status": "done",
        "fetched_at":   now_iso(),
    }


# ── 任务处理 ──────────────────────────────────────────────────────────

async def process_viral_posts(pending_only: bool = True):
    """处理爆款帖子：pending → 抓取 → done"""
    try:
        q = sb.table("viral_posts").select("id, url")
        if pending_only:
            q = q.eq("fetch_status", "pending")
        else:
            q = q.eq("fetch_status", "done").not_.is_("url", "null")
        result = q.execute()

        for row in result.data:
            log.info(f"{'抓取' if pending_only else '刷新'}爆款帖子: {row['url'][:60]}")
            if pending_only:
                sb.table("viral_posts").update({"fetch_status": "loading"}).eq("id", row["id"]).execute()
            try:
                data = await fetch_post_data(row["url"])
                if not pending_only:
                    # 刷新模式只更新数据，不改状态
                    data = {k: v for k, v in data.items() if k in ("likes", "saves", "comments", "views", "fetched_at")}
                sb.table("viral_posts").update(data).eq("id", row["id"]).execute()
                log.info(f"  ✅ 完成: {data.get('title', '')[:30] or row['url'][:40]}")
                await asyncio.sleep(2)
            except Exception as e:
                if pending_only:
                    sb.table("viral_posts").update({"fetch_status": "error"}).eq("id", row["id"]).execute()
                log.error(f"  ❌ 失败: {e}")
    except Exception as e:
        log.error(f"process_viral_posts 出错: {e}")


async def process_benchmark_accounts(pending_only: bool = True):
    """处理对标账号：pending → 抓取 → done"""
    try:
        q = sb.table("benchmark_accounts").select("id, xhs_url, name")
        if pending_only:
            q = q.eq("fetch_status", "pending")
        else:
            q = q.eq("fetch_status", "done").not_.is_("xhs_url", "null")
        result = q.execute()

        for row in result.data:
            xhs_url = row.get("xhs_url")
            if not xhs_url:
                continue
            log.info(f"{'抓取' if pending_only else '刷新'}对标账号: {row.get('name', xhs_url[:40])}")
            if pending_only:
                sb.table("benchmark_accounts").update({"fetch_status": "loading"}).eq("id", row["id"]).execute()
            try:
                data = await fetch_account_data(xhs_url)
                if not pending_only:
                    data = {k: v for k, v in data.items() if k in ("followers", "recent_posts", "avatar_url", "bio", "fetched_at")}
                sb.table("benchmark_accounts").update(data).eq("id", row["id"]).execute()
                log.info(f"  ✅ 完成: {data.get('name', '') or row.get('name', '')} 粉丝={data.get('followers', '?')}")
                await asyncio.sleep(3)
            except Exception as e:
                if pending_only:
                    sb.table("benchmark_accounts").update({"fetch_status": "error"}).eq("id", row["id"]).execute()
                log.error(f"  ❌ 失败: {e}")
    except Exception as e:
        log.error(f"process_benchmark_accounts 出错: {e}")


async def process_topics(pending_only: bool = True):
    """处理选题库参考帖子：有 reference_url 的才处理"""
    try:
        q = sb.table("topics").select("id, reference_url").not_.is_("reference_url", "null")
        if pending_only:
            q = q.eq("fetch_status", "pending")
        else:
            q = q.eq("fetch_status", "done")
        result = q.execute()

        for row in result.data:
            ref_url = row.get("reference_url", "")
            if not ref_url or "xiaohongshu.com" not in ref_url:
                continue
            if pending_only:
                sb.table("topics").update({"fetch_status": "loading"}).eq("id", row["id"]).execute()
            try:
                data = await fetch_post_data(ref_url)
                sb.table("topics").update({
                    "fetch_status": "done",
                    "ref_likes":    data["likes"],
                    "ref_saves":    data["saves"],
                    "ref_comments": data["comments"],
                    "ref_views":    data["views"],
                    "fetched_at":   now_iso(),
                }).eq("id", row["id"]).execute()
                log.info(f"  ✅ 选题参考更新: 👍{data['likes']} ❤️{data['saves']}")
                await asyncio.sleep(2)
            except Exception as e:
                if pending_only:
                    sb.table("topics").update({"fetch_status": "error"}).eq("id", row["id"]).execute()
                log.error(f"  ❌ 选题参考失败: {e}")
    except Exception as e:
        log.error(f"process_topics 出错: {e}")


# ── 定时全量同步 ──────────────────────────────────────────────────────

async def full_sync():
    """每12小时全量刷新所有已抓取记录"""
    if not client_ready:
        log.warning("XHS 客户端未就绪，跳过全量同步")
        return
    log.info("=" * 50)
    log.info("开始全量数据同步")
    log.info("=" * 50)
    await process_viral_posts(pending_only=False)
    await process_benchmark_accounts(pending_only=False)
    await process_topics(pending_only=False)
    log.info("✅ 全量同步完成")


# ── 主轮询循环 ────────────────────────────────────────────────────────

async def poll_loop():
    """每5秒检查一次待处理任务"""
    log.info("轮询启动，每 5 秒检查待处理任务...")
    while True:
        if client_ready:
            await process_viral_posts(pending_only=True)
            await process_benchmark_accounts(pending_only=True)
            await process_topics(pending_only=True)
        await asyncio.sleep(5)


# ── 入口 ──────────────────────────────────────────────────────────────

async def main():
    log.info("=" * 50)
    log.info("XHS Dashboard 爬虫服务 启动")
    log.info("=" * 50)

    await init_xhs_client()

    # 定时全量同步（每12小时）
    scheduler = AsyncIOScheduler(timezone="Asia/Shanghai")
    scheduler.add_job(full_sync, "interval", hours=12, id="full_sync", replace_existing=True)
    scheduler.start()
    log.info("✅ 定时任务已注册（每 12 小时全量同步）")

    await poll_loop()


if __name__ == "__main__":
    asyncio.run(main())
