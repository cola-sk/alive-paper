#!/bin/sh
# ================================================================
# kindle-screensaver-update.sh
#
# 在越狱 Kindle 上运行的屏保更新脚本
# 每次执行：从服务器拉取最新截图 → 替换屏保 → 刷新屏幕
#
# 安装方式（通过 MobileRead KTerm 或 SSH）：
#   1. 把此脚本上传到 /mnt/us/kindle-screensaver-update.sh
#   2. chmod +x /mnt/us/kindle-screensaver-update.sh
#   3. 用 MobileRead 的 KUAL + Helper 设置 cron，或在 KTerm 手动运行
# ================================================================

# ── 配置区 ────────────────────────────────────────────────────────
# 部署到 Vercel 后，把下面改成 Vercel 固定域名，如：
#   SERVER_URL="https://kindle-news.vercel.app/screensaver.png"
# 本地调试时继续用局域网地址：
#   SERVER_URL="http://10.255.105.246:3456/screensaver.png"
SERVER_URL="https://alive-paper.tz0618.uk/screensaver.png"
SAVE_DIR="/mnt/us/screensaver"
SAVE_FILE="$SAVE_DIR/dashboard.png"
LOG_FILE="/mnt/us/kindle-screensaver.log"
# ─────────────────────────────────────────────────────────────────

mkdir -p "$SAVE_DIR"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"
}

log "开始更新屏保..."

# 下载新截图（最多等 15 秒）
TMP_FILE="$SAVE_DIR/dashboard_tmp.png"
if wget -q -T 15 --no-check-certificate -O "$TMP_FILE" "$SERVER_URL" 2>/dev/null; then
  # 验证是有效的 PNG（前 4 字节是 PNG 签名）
  if [ -s "$TMP_FILE" ]; then
    mv "$TMP_FILE" "$SAVE_FILE"
    log "下载成功: $(ls -lh $SAVE_FILE | awk '{print $5}')"
  else
    rm -f "$TMP_FILE"
    log "错误: 下载文件为空"
    exit 1
  fi
else
  rm -f "$TMP_FILE"
  log "错误: 下载失败，检查服务器 $SERVER_URL 是否可达"
  exit 1
fi

# ── 替换 Kindle 屏保并立即刷新屏幕 ──────────────────────────────
KINDLE_SS_DIR="/usr/share/blanket/screensaver"
FBINK="/mnt/us/usbnet/bin/fbink"
MNTROOT="/usr/sbin/mntroot"

# 1. 挂载系统分区为可写，替换全部 bg_ss*.png（Kindle 随机选这些）
$MNTROOT rw 2>/dev/null
if [ -d "$KINDLE_SS_DIR" ]; then
  for i in 00 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19; do
    cp "$SAVE_FILE" "$KINDLE_SS_DIR/bg_ss${i}.png" 2>/dev/null
  done
  log "已替换全部 bg_ss*.png (共20张)"
fi
$MNTROOT ro 2>/dev/null

# 2. 通知 blanket 重新选图（不直接操作屏幕）
pkill -HUP blanket 2>/dev/null || true
log "完成"
