#!/bin/bash
# push.sh — 重新生成截图并推送到 Kindle
# 用法：./push.sh [kindle_ip]

KINDLE_IP="${1:-10.255.105.67}"
SERVER="http://localhost:3456"

echo "→ 刷新数据..."
curl -s -X POST "$SERVER/refresh" > /dev/null

echo "→ 生成截图..."
curl -s -X POST "$SERVER/screenshot" > /dev/null

echo "→ 等待截图完成..."
sleep 10

echo "→ 推送到 Kindle ($KINDLE_IP)..."
ssh -o StrictHostKeyChecking=no root@"$KINDLE_IP" 'sh /mnt/us/kindle-screensaver-update.sh'

echo ""
echo "→ 最新日志："
ssh -o StrictHostKeyChecking=no root@"$KINDLE_IP" 'tail -4 /mnt/us/kindle-screensaver.log'
