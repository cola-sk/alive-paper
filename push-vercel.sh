#!/bin/bash
# push-vercel.sh
# 生成最新截图并上传到 Vercel Blob
# 依赖：本地 server 正在运行（npm start）

set -e
cd "$(dirname "$0")"

PORT=${PORT:-3456}

echo "▸ 刷新数据 + 生成截图 + 上传 Blob..."
RESULT=$(curl -sf -X POST "http://localhost:$PORT/screenshot")
echo "$RESULT"

if echo "$RESULT" | grep -q '"ok":true'; then
  BLOB_URL=$(echo "$RESULT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const r=JSON.parse(d);console.log(r.blobUrl||'（本地模式，未配置 Blob Token）')}catch(e){}})")
  echo "✓ 完成。Blob URL: $BLOB_URL"
else
  echo "✗ 失败，检查 npm start 是否运行 或 查看服务日志"
  exit 1
fi
