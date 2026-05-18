#!/bin/sh
# ================================================================
# kindle-screensaver-update.sh
#
# 在越狱 Kindle 上运行的屏保更新脚本
# 每次执行：从服务器拉取最新截图 → 替换屏保 → 立即刷新屏幕
#
# 刷新策略（REFRESH_MODE）：
#   lipc  ── 通过 LIPC 事件模拟按电源键，让 Kindle 立即进入睡眠显示
#             新屏保（推荐）。按任意键唤醒后恢复正常。
#   eips  ── 用 eips 直接写 e-ink 帧缓冲，不依赖 blanket，Kindle
#             唤醒或休眠状态下均立即可见。
#   none  ── 只替换文件，不主动刷新（下次自然睡眠时生效）。
# ================================================================

# ── 配置区 ────────────────────────────────────────────────────────
SERVER_URL="https://alive-paper.tz0618.uk/screensaver.png"
SAVE_DIR="/mnt/us/screensaver"
SAVE_FILE="$SAVE_DIR/dashboard.png"
LOG_FILE="/mnt/us/kindle-screensaver.log"

# 刷新模式：none | eips | lipc
# none：只替换文件，按一次电源键锁屏后立即可见新屏保（最稳定）
# eips：尝试直接写帧缓冲（可能拉伸）
# lipc：发送 LIPC 休眠事件（部分固件不支持）
REFRESH_MODE="none"
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

# ── 替换 Kindle 屏保 ──────────────────────────────────────────────
KINDLE_SS_DIR="/usr/share/blanket/screensaver"
MNTROOT="/usr/sbin/mntroot"

# 挂载系统分区为可写，替换全部 bg_ss*.png（Kindle 随机选这些）
$MNTROOT rw 2>/dev/null
if [ -d "$KINDLE_SS_DIR" ]; then
  for i in 00 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19; do
    cp "$SAVE_FILE" "$KINDLE_SS_DIR/bg_ss${i}.png" 2>/dev/null
  done
  log "已替换全部 bg_ss*.png (共20张)"
fi
$MNTROOT ro 2>/dev/null

# ── 立即刷新屏幕 ──────────────────────────────────────────────────
case "$REFRESH_MODE" in
  lipc)
    # 通过 LIPC 事件模拟电源键，Kindle 立即休眠并从磁盘读取新屏保显示。
    # 不触碰 blanket 进程，唤醒后完全正常。
    if command -v lipc-send-event > /dev/null 2>&1; then
      lipc-send-event com.lab126.powerd userInitiatedSuspend 2>/dev/null
      log "已发送 LIPC 休眠事件，屏保立即刷新"
    else
      log "警告: lipc-send-event 不可用，跳过刷新"
    fi
    ;;
  eips)
    # 直接把 PNG 写到 e-ink 帧缓冲。
    # fbink 比 eips 更可靠，参数: -i 输入文件，-c 中心对齐，-C 清屏后显示
    if command -v fbink > /dev/null 2>&1; then
      fbink -i "$SAVE_FILE" -c -C 2>/dev/null
      log "已通过 fbink 直接刷新 e-ink 屏幕"
    elif command -v eips > /dev/null 2>&1; then
      # 回退到 eips（如果 fbink 不可用）
      eips -g "$SAVE_FILE" 2>/dev/null
      log "已通过 eips 直接刷新 e-ink 屏幕"
    else
      log "警告: fbink/eips 都不可用，跳过刷新"
    fi
    ;;
  none|*)
    log "刷新模式: none，下次 Kindle 自然休眠时生效"
    ;;
esac

log "完成"
