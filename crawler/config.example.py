# ================================================================
# 爬虫配置模板 — 复制为 config.py 后填入真实值
# config.py 已在 .gitignore 中，不会提交到仓库
# ================================================================

# ── Supabase 连接 ──────────────────────────────────────────────
SUPABASE_URL = "https://<your-project-id>.supabase.co"
SUPABASE_KEY = "sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxxxx"

# ── 账号映射：XHS 用户 ID → 管理台内部 account_id ──────────────
# 如何找 xhs_user_id：
#   打开小红书 PC 端，进入账号主页
#   URL 格式：xiaohongshu.com/user/profile/{xhs_user_id}
#   复制最后那段 ID
ACCOUNT_MAP = {
    # "665c45cb000000000700713c": 7,
    # "69d636e30000000026000aec": 9,
}

# ── MediaCrawler 输出目录 ─────────────────────────────────────
# MediaCrawler 默认把数据存在自己的 data/ 目录下，填绝对路径
MEDIACRAWLER_DATA_DIR = "/Users/<you>/MediaCrawler/data/xhs"

# ── 爬取设置 ──────────────────────────────────────────────────
# 每个账号最多抓取多少条笔记（避免封号，建议 ≤ 50）
MAX_NOTES_PER_ACCOUNT = 30

# 两次请求之间的间隔秒数（模拟人工，降低风控风险）
REQUEST_DELAY_SECONDS = 2
