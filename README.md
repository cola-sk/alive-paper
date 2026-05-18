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

### 工作原理

Kindle 每天自动完成一个完整更新周期（无需手动操作）：
1. **Mac 端** → 每 30 分钟执行一次 `push-vercel.sh` 生成新截图并上传到 CDN
2. **Kindle 端** → 每 30 分钟检查一次并下载最新截图

**条件：** Mac 服务器必须保持运行（`npm start`）。

### Kindle 定时任务配置

首次设置后会永久生效（即使重启也不会丢失）。

#### 1️⃣ 上传更新脚本

```bash
# 将屏保更新脚本上传到 Kindle
cat kindle/kindle-screensaver-update.sh | ssh root@<KINDLE_IP> \
  'cat > /mnt/us/kindle-screensaver-update.sh && chmod +x /mnt/us/kindle-screensaver-update.sh'
```

#### 2️⃣ 配置定时任务（30分钟间隔）

```bash
# SSH 连接到 Kindle
ssh root@<KINDLE_IP>

# 进入交互式 shell，执行以下命令：
/usr/sbin/mntroot rw              # 挂载系统分区为可写
vi /etc/crontab/root              # 编辑 crontab

# 在文件末尾添加一行：
# */30 * * * * /bin/sh /mnt/us/kindle-screensaver-update.sh >> /mnt/us/kindle-screensaver.log 2>&1

# 保存退出（按 Esc，输入 :wq），然后：
/usr/sbin/mntroot ro              # 改回只读
exit                              # 退出 SSH
```

**完整示例（复制粘贴）：**
```bash
ssh root@10.45.122.67 '
/usr/sbin/mntroot rw
echo "*/30 * * * * /bin/sh /mnt/us/kindle-screensaver-update.sh >> /mnt/us/kindle-screensaver.log 2>&1" >> /etc/crontab/root
/usr/sbin/mntroot ro
echo "Cron 配置完成"
'
```

### 查看和管理定时任务

#### 查看已配置的定时任务

```bash
ssh root@<KINDLE_IP> 'cat /etc/crontab/root | grep kindle'
```

**输出示例：**
```
*/30 * * * * /bin/sh /mnt/us/kindle-screensaver-update.sh >> /mnt/us/kindle-screensaver.log 2>&1
```

#### 删除定时任务（如需停止自动更新）

```bash
ssh root@<KINDLE_IP> '
/usr/sbin/mntroot rw
sed -i.bak "/kindle-screensaver-update/d" /etc/crontab/root
/usr/sbin/mntroot ro
echo "Cron 任务已删除"
'
```

### 查看执行日志

#### 实时查看最新 5 条日志

```bash
ssh root@<KINDLE_IP> 'tail -5 /mnt/us/kindle-screensaver.log'
```

**成功输出示例：**
```
2026-05-18 14:30:05 开始更新屏保...
2026-05-18 14:30:06 下载成功: 32.1K
2026-05-18 14:30:06 已替换全部 bg_ss*.png (共20张)
2026-05-18 14:30:07 完成
```

#### 查看完整日志

```bash
ssh root@<KINDLE_IP> 'cat /mnt/us/kindle-screensaver.log'
```

#### 监控日志（持续查看新增内容）

```bash
ssh root@<KINDLE_IP> 'tail -f /mnt/us/kindle-screensaver.log'
# 按 Ctrl+C 退出
```

#### 清空日志

```bash
ssh root@<KINDLE_IP> 'echo "" > /mnt/us/kindle-screensaver.log'
```

#### 检查最后一次执行时间和状态

```bash
ssh root@<KINDLE_IP> 'stat /mnt/us/screensaver/dashboard.png | grep Modify'
```

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

**Q: 定时任务没有工作（屏保没有自动更新）**
1. 确认定时任务已配置：
   ```bash
   ssh root@<KINDLE_IP> 'cat /etc/crontab/root | grep kindle'
   ```
   应该看到 `*/30 * * * * /bin/sh /mnt/us/kindle-screensaver-update.sh ...` 一行

2. 查看最近的执行日志是否有错误：
   ```bash
   ssh root@<KINDLE_IP> 'tail -10 /mnt/us/kindle-screensaver.log'
   ```

3. 如果日志显示"下载失败"，检查：
   - Mac 服务器是否运行：`curl http://localhost:3456/status`
   - Kindle 能否访问服务器：`ssh root@<KINDLE_IP> 'wget -q https://alive-paper.tz0618.uk/screensaver.png -O /tmp/test.png && echo OK'`

4. 如果定时任务从未执行过，重新配置：
   ```bash
   ssh root@<KINDLE_IP> '
   /usr/sbin/mntroot rw
   echo "*/30 * * * * /bin/sh /mnt/us/kindle-screensaver-update.sh >> /mnt/us/kindle-screensaver.log 2>&1" >> /etc/crontab/root
   /usr/sbin/mntroot ro
   '
   ```

**Q: 日志文件不存在或执行脚本时出错**
- 确认脚本存在且有执行权限：
  ```bash
  ssh root@<KINDLE_IP> 'ls -l /mnt/us/kindle-screensaver-update.sh'
  ```
  
- 如果不存在或权限不对，重新上传：
  ```bash
  cat kindle/kindle-screensaver-update.sh | ssh root@<KINDLE_IP> \
    'cat > /mnt/us/kindle-screensaver-update.sh && chmod +x /mnt/us/kindle-screensaver-update.sh'
  ```

**Q: 屏保图片很久没变，但日志显示在下载**
- 这是正常现象：Kindle 显示屏保的时机受限
  - 只在 Kindle 进入睡眠状态时显示
  - 新图片在下次睡眠时才会显示（可能延迟 5-30 分钟）

- 快速验证：按电源键锁屏，然后再按一次唤醒，应该看到新图片

---

## 项目结构

### Mac 端（本仓库）

```
kindle-news/
├── server.js                        # Express 主服务器
├── src/
│   ├── screensaver-template.js      # 600×800 HTML 模板
│   └── services/
│       ├── screenshot.js            # Puppeteer 截图（已修复 Chrome 优先级）
│       ├── weather.js               # Open-Meteo 天气
│       └── stocks.js                # Yahoo Finance 股票
├── kindle/
│   ├── ssh_enable.sh                # Kindle 上一次性 SSH 安装脚本
│   ├── emergency.sh                 # Kindle 开机自启脚本
│   └── kindle-screensaver-update.sh # Kindle 屏保更新脚本（核心）
├── push-vercel.sh                   # Mac 端推送脚本（上传到 CDN）
├── .env                             # 本地配置（不入 git）
├── README.md                        # 本文件
└── JAILBREAK_GUIDE.md               # 越狱 + SSH 完整指南
```

### Kindle 端（系统文件）

| 路径 | 说明 |
|------|------|
| `/mnt/us/kindle-screensaver-update.sh` | **屏保更新脚本**（从本仓库上传） |
| `/mnt/us/screensaver/dashboard.png` | **最新的屏保 PNG 文件** |
| `/mnt/us/kindle-screensaver.log` | **更新执行日志** |
| `/etc/crontab/root` | **定时任务配置**（系统分区，需 mntroot rw） |
| `/usr/share/blanket/screensaver/` | **Kindle 屏保库** `bg_ss00-19.png` |

### 工作流全景

```
Mac 层（每 30 分钟）
  ├─ crontab: push-vercel.sh
  │   ├─ POST localhost:3456/screenshot
  │   │   ├─ 拉取天气/股票数据
  │   │   ├─ 用 Puppeteer 生成 PNG
  │   │   ├─ 用 Sharp 转灰度
  │   │   └─ 保存到 public/screensaver.png
  │   └─ 上传到 Vercel Blob CDN
  │
  └─ CDN 层
      └─ GET https://alive-paper.tz0618.uk/screensaver.png
          └─ 302 重定向到 Blob 存储

Kindle 层（每 30 分钟）
  └─ crontab: /bin/sh /mnt/us/kindle-screensaver-update.sh
      ├─ wget 下载最新截图
      ├─ mntroot rw（挂载系统分区）
      ├─ 替换 /usr/share/blanket/screensaver/bg_ss*.png
      ├─ mntroot ro（改回只读）
      └─> 日志记录到 /mnt/us/kindle-screensaver.log
```