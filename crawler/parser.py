# ================================================================
# 数据解析工具
# 处理小红书返回的各种数字格式
# ================================================================

import re


def parse_count(value) -> int:
    """
    解析小红书的数字字符串，支持以下格式：
      "1234"  → 1234
      "1.2万" → 12000
      "12.3k" → 12300
      "10万+" → 100000
      None    → 0
    """
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
        # 尝试提取纯数字
        nums = re.findall(r"\d+\.?\d*", s)
        return int(float(nums[0])) if nums else 0


def parse_note(raw: dict) -> dict:
    """
    将 MediaCrawler 输出的笔记 JSON 转换为标准格式。
    MediaCrawler 字段参考：
      note_id, user_id, title, desc, liked_count,
      book_mark_count, comment_count, share_count,
      image_list, tag_list, time, ip_location
    """
    return {
        "xhs_note_id":  raw.get("note_id") or raw.get("id", ""),
        "xhs_user_id":  raw.get("user_id") or raw.get("author_id", ""),
        "title":        raw.get("title", "").strip(),
        "caption":      raw.get("desc", "").strip(),
        "likes":        parse_count(raw.get("liked_count") or raw.get("likes")),
        "saves":        parse_count(raw.get("book_mark_count") or raw.get("collects") or raw.get("saves")),
        "comments":     parse_count(raw.get("comment_count") or raw.get("comments")),
        "views":        parse_count(raw.get("view_count") or raw.get("views")),
        "shares":       parse_count(raw.get("share_count") or raw.get("shares")),
        "images":       raw.get("image_list", []),
        "tags":         [t.get("name", "") for t in raw.get("tag_list", []) if t.get("name")],
        "published_at": raw.get("time"),
    }


def parse_user(raw: dict) -> dict:
    """
    将 MediaCrawler 输出的用户 JSON 转换为标准格式。
    """
    return {
        "xhs_user_id": raw.get("user_id") or raw.get("id", ""),
        "followers":   parse_count(raw.get("fans") or raw.get("followers")),
        "following":   parse_count(raw.get("follows") or raw.get("following")),
        "notes_count": parse_count(raw.get("note_count") or raw.get("notes")),
    }
