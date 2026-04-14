#!/bin/bash
# ================================================================
# 一键设置爬虫服务开机自启（只需运行一次）
# 运行方式：
#   chmod +x crawler/setup_autostart.sh
#   ./crawler/setup_autostart.sh
# ================================================================

set -e

PLIST_SRC="$(cd "$(dirname "$0")" && pwd)/com.xhs.dashboard.crawler.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.xhs.dashboard.crawler.plist"
LOG_DIR="$(cd "$(dirname "$0")" && pwd)/logs"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  XHS Dashboard 爬虫服务 — 自启动配置"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 创建日志目录
mkdir -p "$LOG_DIR"

# 卸载旧版本（如果存在）
if launchctl list | grep -q "com.xhs.dashboard.crawler" 2>/dev/null; then
    echo "▶ 卸载旧版本..."
    launchctl unload "$PLIST_DEST" 2>/dev/null || true
fi

# 安装新版本
echo "▶ 安装 LaunchAgent..."
cp "$PLIST_SRC" "$PLIST_DEST"
launchctl load "$PLIST_DEST"

echo ""
echo "✅ 配置完成！爬虫服务将在每次登录后自动启动。"
echo ""
echo "常用命令："
echo "  查看状态：launchctl list | grep xhs"
echo "  查看日志：tail -f $LOG_DIR/server.log"
echo "  手动停止：launchctl unload $PLIST_DEST"
echo "  手动启动：launchctl load $PLIST_DEST"
echo ""
