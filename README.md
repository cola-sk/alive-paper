# Kindle 天气 + 股票仪表盘

将越狱 Kindle 8th Gen 变成永久显示天气预报和股票行情的墨水屏看板。

```
┌─────────────────────────┐
│  北京通州  Thu May 15   │
│  ⛅ 24°C  东风 3级      │
│                         │
│  4天预报：              │
│  周四 22° 周五 19°      │
│  周六 25° 周日 20°      │
│                         │
│  TSLA  342.5  +2.1%    │
│  AAPL  213.8  -0.4%    │
│  TSM   175.2  +1.8%    │
│  MSFT  432.1  +0.9%    │
│  GOOGL 178.4  +1.2%    │
│  ^NDX  19842  +0.7%    │
└─────────────────────────┘
```

---

## 快速开始

### 前置条件

- Kindle 8th Gen（已越狱，已启用 SSH）→ 见 [JAILBREAK_GUIDE.md](./JAILBREAK_GUIDE.md)
- Mac 与 Kindle 在同一 WiFi 网段
- Node.js 18+，Google Chrome（供 Puppeteer 截图）

### 安装

```bash
git clone <this-repo> kindle-news
cd kindle-news
npm install
cp .env.example .env   # 或直接编辑 .env
```

### 配置 `.env`

```ini
# 服务器端口（Kindle 脚本里的 IP:PORT 要一致）
PORT=3456

# 天气位置（Open-Meteo，无需 API Key）
WEATHER_LAT=39.9089
WEATHER_LON=116.6572
WEATHER_CITY=北京通州

# 股票代码（Yahoo Finance 格式）
STOCK_SYMBOLS=TSLA,AAPL,TSM,MSFT,GOOGL,^NDX

# 截图间隔（分钟）
SCREENSHOT_INTERVAL_MIN=30
```

### 启动服务器

```bash
npm start
# Kindle Dashboard 运行中 → http://localhost:3456
```

---

## 日常使用：手动推送屏保

### 方法零：使用仓库脚本（最方便）

```bash
./push.sh
```

默认会推送到 `10.255.105.67`。如果 Kindle IP 变化：

```bash
./push.sh 10.255.105.88
```

### 方法一：一键命令（推荐）

```bash
# 重新生成截图 + 推送到 Kindle
curl -s -X POST http://localhost:3456/screenshot && sleep 10 && \
ssh root@10.255.105.67 'sh /mnt/us/kindle-screensaver-update.sh'
```

### 方法二：分步执行

```bash
# 1. 强制刷新数据（天气 + 股票）
curl -s -X POST http://localhost:3456/refresh

# 2. 生成新截图
curl -s -X POST http://localhost:3456/screenshot

# 3. 等待 Puppeteer 完成（约 5-10 秒）
sleep 10

# 4. 推送到 Kindle
ssh root@10.255.105.67 'sh /mnt/us/kindle-screensaver-update.sh'
```

### 验证推送结果

```bash
ssh root@10.255.105.67 'tail -4 /mnt/us/kindle-screensaver.log'
```

**成功输出：**
```
2026-05-15 18:09:19 开始更新屏保...
2026-05-15 18:09:19 下载成功: 66.3K
2026-05-15 18:09:19 已替换全部 bg_ss*.png (共20张)
2026-05-15 18:09:19 完成
```

---

## 自动更新

Kindle 在开机后会自动每 **30 分钟**更新一次屏保，无需手动操作。

触发时机：Kindle 每次启动 → `emergency.sh` → 后台循环（`sleep 1800`）→ 拉取并替换屏保。

**条件：** Mac 服务器必须保持运行（`npm start`）。

---

## 服务器 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 浏览器预览页面 |
| `/screensaver.png` | GET | 最新屏保图片（Kindle 下载此地址） |
| `/status` | GET | 数据状态（hasWeather, hasStocks, lastUpdated） |
| `/refresh` | POST | 立即重新拉取天气和股票数据 |
| `/screenshot` | POST | 立即重新生成截图 |

---

## 修改显示内容

### 更换城市

修改 `.env`：
```ini
WEATHER_LAT=31.23
WEATHER_LON=121.47
WEATHER_CITY=上海
```

重启服务器：`npm start`

### 更换股票

修改 `.env`：
```ini
# 支持美股代码和指数（Yahoo Finance 格式）
# ^NDX=纳斯达克100  ^GSPC=标普500  BTC-USD=比特币
STOCK_SYMBOLS=TSLA,AAPL,TSM,MSFT,GOOGL,^NDX,PLTR,NVDA,SNDK,OPEN,U,SQ,ABNB
```

### 更换 Mac IP 后更新 Kindle 脚本

```bash
# 1. 修改 kindle/kindle-screensaver-update.sh 顶部的 SERVER_URL
SERVER_URL="http://<NEW_IP>:3456/screensaver.png"

# 2. 推送到 Kindle
cat kindle/kindle-screensaver-update.sh | ssh root@<KINDLE_IP> \
  'cat > /mnt/us/kindle-screensaver-update.sh && chmod +x /mnt/us/kindle-screensaver-update.sh'
```

---

## 常见问题

**Q: 屏保没有变化**
1. 检查 Mac 服务器是否运行：`curl http://localhost:3456/status`
2. 确认 Kindle 和 Mac 在同一 WiFi
3. 查看 Kindle 日志：`ssh root@<IP> 'tail -5 /mnt/us/kindle-screensaver.log'`

**Q: 股票数据为空**
```bash
# 强制刷新数据
curl -s -X POST http://localhost:3456/refresh
# 等 5 秒后检查
curl -s http://localhost:3456/status
```

**Q: SSH 连不上**
- Kindle 重启后 SSH 会自动恢复（约 30 秒）
- 如仍失效：打开书店 → Mesquito → WinterBreak（重跑 jb.sh）

**Q: 想要立即在屏幕显示（而非等锁屏）**
屏保在 Kindle 进入睡眠时显示。锁屏操作：按一次电源键，屏幕关闭，再看到仪表盘。

---

## 项目结构

```
kindle-news/
├── server.js                        # Express 主服务器
├── src/
│   ├── screensaver-template.js      # 600×800 HTML 模板
│   └── services/
│       ├── screenshot.js            # Puppeteer 截图
│       ├── weather.js               # Open-Meteo 天气
│       └── stocks.js                # Yahoo Finance 股票
├── kindle/
│   ├── ssh_enable.sh                # Kindle 上一次性 SSH 安装脚本
│   ├── emergency.sh                 # Kindle 开机自启脚本
│   └── kindle-screensaver-update.sh # Kindle 屏保更新脚本
├── .env                             # 本地配置（不入 git）
├── README.md                        # 本文件
└── JAILBREAK_GUIDE.md               # 越狱 + SSH 完整指南
```
