# Kindle 8th Gen 越狱 + SSH + 屏保仪表盘 完整指南

**实测设备信息**

| 项目 | 值 |
|------|-----|
| 型号 | Kindle 8th Generation (2016) |
| 设备代码 | G000 |
| 固件版本 | 5.16.2.1.1 (409749 002) |
| 屏幕分辨率 | 600×800px |
| 处理器 | ARM32 (armv7l) |
| 越狱方案 | WinterBreak 1.7.0 |
| SSH 方案 | Dropbear via USBNet |

---

## 总览

```
阶段 1：越狱          WinterBreak 1.7.0 (Mesquito 机制)
阶段 2：安装 Hotfix   KindleModding Universal Hotfix v2.3.7
阶段 3：部署 SSH      dropbearmulti + 修改 jb.sh 触发安装
阶段 4：屏保仪表盘    Mac 服务器 → Kindle 定时拉取 PNG
```

---

## 阶段 1：越狱（WinterBreak 1.7.0）

### 1.1 下载 WinterBreak

```bash
cd ~/Downloads
curl -L -o WinterBreak.tar.gz \
  https://github.com/iiroak/WinterBreak/releases/download/1.7.0/WinterBreak.tar.gz
mkdir -p WinterBreak_extracted
tar -xzf WinterBreak.tar.gz -C WinterBreak_extracted/
ls -la WinterBreak_extracted/
```

**预期文件：**
- `jb.sh` — 越狱脚本（由 Mesquito 触发，以 root 运行）
- `mesquito/` — Mesquito 应用目录
- `apps/com.hackerdude.winterbreak/` — WinterBreak Mesquito app
- `patchedUks.sqsh` — 修补后的开发者密钥存储
- `.active_content_sandbox/` — 商店注入点（**隐藏文件夹**）

### 1.2 填充存储空间（防 OTA 自动更新）

```bash
# 插 USB，确认挂载
ls /Volumes/Kindle

# 填充剩余空间，防止亚马逊推 OTA 固件更新
mkdir -p /Volumes/Kindle/fill_disk
dd if=/dev/zero of=/Volumes/Kindle/fill_disk/filler.bin bs=1m 2>&1
# 等待 dd 报 "no space left on device" 自然结束

df -h /Volumes/Kindle  # 确认 Avail < 100MB
```

### 1.3 复制越狱文件到 Kindle

```bash
cp -R ~/Downloads/WinterBreak_extracted/. /Volumes/Kindle/

# 验证关键文件
ls /Volumes/Kindle/jb.sh
ls /Volumes/Kindle/.active_content_sandbox/store/resource/cachedResources/index.html

diskutil eject /Volumes/Kindle
```

### 1.4 在 Kindle 上触发越狱（手动操作）

> **核心原理：** `.active_content_sandbox` 目录拦截 Kindle 商店，加载本地 Mesquito
> 界面，通过 `com.lab126.transfer` nativeBridge 以 root 权限执行 `jb.sh`。

1. 拔 USB 线
2. 打开飞行模式：**Settings → Airplane Mode → ON**
3. 重启：**Settings → Device Options → Restart**
4. 打开 Kindle **书店**（购物袋图标）
5. 弹出"关闭飞行模式？" → 点击 **是（YES）**（⚠️ 点"否"会直接退出）
6. 等待加载 → 出现 **Mesquito** 界面（而非亚马逊商店）
7. 点击 **WinterBreak** 图标
8. 等待屏幕显示越狱日志（约 30-60 秒）

**成功标志：**
```
*** Finished installing jailbreak! ***
***   Please Install HOTFIX now    ***
```

验证：
```bash
# 插 USB，查看日志
cat /Volumes/Kindle/winterbreak.log | tail -5
# 正常输出：Enabled developer flag / Enabled mntus exec flag
```

---

## 阶段 2：安装 Hotfix

### 2.1 下载并复制 Hotfix

```bash
cd ~/Downloads
curl -L -o "Update_hotfix_universal.bin" \
  "https://github.com/KindleModding/Hotfix/releases/latest/download/Update_hotfix_universal.bin"
ls -lh Update_hotfix_universal.bin  # 应 > 3MB

# 插 USB
cp ~/Downloads/Update_hotfix_universal.bin /Volumes/Kindle/
diskutil eject /Volumes/Kindle
```

### 2.2 在 Kindle 上安装（手动操作）

1. 拔 USB 线
2. 确认飞行模式 ON
3. **Settings → 右上角 ⋮ → Update Your Kindle**
4. 确认 → 等待自动重启（约 2 分钟）
5. 重启后图书馆出现 **"Run Hotfix"** 书本
6. 点击 **Run Hotfix** → 等待完成

---

## 阶段 3：启用 WiFi SSH

### 3.1 下载 USBNet（含 dropbearmulti）

```bash
cd ~/Downloads
curl -L -o "kindle-usbnet.tar.xz" \
  "https://storage.gra.cloud.ovh.net/v1/AUTH_2ac4bfee353948ec8ea7fd1710574097/mr-public/Touch/kindle-usbnet-0.22.N-r19297.tar.xz"
mkdir -p usbnet_extract
tar -xf kindle-usbnet.tar.xz -C usbnet_extract

# 验证是 ARM32 二进制
file usbnet_extract/USBNetwork/src/usbnet/bin/dropbearmulti
# 预期: ELF 32-bit LSB executable, ARM, EABI5
```

### 3.2 部署文件到 Kindle（USB）

```bash
until ls /Volumes/Kindle &>/dev/null; do sleep 1; done && echo "已挂载"

# 复制 USBNet（删除不必要的大文件节省空间）
cp -r usbnet_extract/USBNetwork/src/usbnet /Volumes/Kindle/usbnet
rm -rf /Volumes/Kindle/usbnet/share /Volumes/Kindle/usbnet/lib
mkdir -p /Volumes/Kindle/usbnet/etc/dropbear

# Upstart 配置（开机自动启动 SSH）
cp usbnet_extract/USBNetwork/src/usbnet.conf /Volumes/Kindle/usbnet.conf
cp usbnet_extract/USBNetwork/src/usbnet-preinit.conf /Volumes/Kindle/usbnet-preinit.conf

# 本仓库脚本
cp kindle/ssh_enable.sh  /Volumes/Kindle/ssh_enable.sh
cp kindle/emergency.sh   /Volumes/Kindle/usbnet/bin/emergency.sh
cp kindle/kindle-screensaver-update.sh /Volumes/Kindle/kindle-screensaver-update.sh
```

### 3.3 修改 jb.sh 追加 SSH 安装调用

```bash
# 在 jb.sh 末尾追加
cat >> /Volumes/Kindle/jb.sh << 'EOF'

# Start SSH daemon
wb_log "*** Starting SSH daemon...         ***"
sh /mnt/us/ssh_enable.sh
wb_log "*** SSH setup done. Check ssh.log  ***"
EOF

tail -5 /Volumes/Kindle/jb.sh  # 验证追加成功
```

### 3.4 安全弹出并触发

```bash
diskutil eject /Volumes/Kindle
```

在 Kindle 上：
1. 拔 USB
2. 打开书店 → 点 **是** → Mesquito → 点 **WinterBreak**
3. 屏幕滚动越狱日志，看到 `*** Starting SSH daemon ***`
4. 等待约 **3-5 分钟**（RSA 密钥在 ARM CPU 上生成较慢）
5. 出现 `*** SSH setup done ***` 即完成

### 3.5 连接 SSH

```bash
# Kindle IP：Settings → Wi-Fi → 查看当前连接详情
ssh root@<KINDLE_IP>
# 密码：mario
```

验证：
```bash
ssh root@10.255.105.67 "uname -a"
# Linux kindle 3.10.53-lab126 ... armv7l GNU/Linux
```

**说明：** `emergency.sh` 已通过 Upstart (`usbnet-preinit.conf`) 配置开机自动
启动 SSH，重启后无需重新操作。

---

## 阶段 4：屏保仪表盘

> 详细使用说明见 [README.md](./README.md)

### 4.1 架构

```
Mac (Node.js :3456)                     Kindle
  每 15 分钟：                          emergency.sh (开机运行)
    ├─ Open-Meteo → 天气数据              └─ 后台循环，每 30 分钟：
    ├─ Yahoo Finance → 股票数据                wget /screensaver.png
    └─ Puppeteer → 600×800px 灰度 PNG          替换 bg_ss*.png (共 20 张)
         └─ GET /screensaver.png
```

### 4.2 配置 `.env`

```ini
PORT=3456
WEATHER_LAT=39.9089
WEATHER_LON=116.6572
WEATHER_CITY=北京通州
STOCK_SYMBOLS=TSLA,AAPL,TSM,MSFT,GOOGL,^NDX
```

### 4.3 配置 Kindle 脚本 IP

```bash
# kindle/kindle-screensaver-update.sh 第一行配置区
SERVER_URL="http://<YOUR_MAC_IP>:3456/screensaver.png"
```

推送到 Kindle：
```bash
cat kindle/kindle-screensaver-update.sh | ssh root@<KINDLE_IP> \
  'cat > /mnt/us/kindle-screensaver-update.sh && chmod +x /mnt/us/kindle-screensaver-update.sh'
```

---

## 关键文件路径（Kindle 上）

| 路径 | 说明 |
|------|------|
| `/mnt/us/jb.sh` | WinterBreak 越狱脚本（已追加 SSH 启动） |
| `/mnt/us/ssh_enable.sh` | SSH 一次性安装脚本（设密码、安装 symlink、启动 dropbear） |
| `/mnt/us/usbnet/bin/dropbearmulti` | SSH daemon 二进制（ARM32） |
| `/mnt/us/usbnet/bin/emergency.sh` | 开机自动启动 SSH + 屏保更新循环 |
| `/mnt/us/kindle-screensaver-update.sh` | 屏保更新脚本 |
| `/mnt/us/usbnet.conf` | Upstart job（volumd 启动后触发 emergency.sh） |
| `/mnt/us/usbnet-preinit.conf` | Upstart preinit 配置 |
| `/usr/share/blanket/screensaver/bg_ss*.png` | 系统屏保图片（被我们替换） |
| `/mnt/us/ssh_enable.log` | SSH 安装日志 |
| `/mnt/us/kindle-screensaver.log` | 屏保更新日志 |
| `/mnt/us/winterbreak.log` | WinterBreak 越狱日志 |

---

## 故障排除

### SSH Connection refused
dropbear 未运行。重新触发：打开书店 → Mesquito → WinterBreak

### Mesquito 界面无 WinterBreak 按钮
`.active_content_sandbox` 可能被清除：
```bash
cp -r ~/Downloads/WinterBreak_extracted/.active_content_sandbox /Volumes/Kindle/
diskutil eject /Volumes/Kindle
# 重启 Kindle，再试
```

### 屏保没有更新
```bash
# 查看 Kindle 日志
ssh root@<IP> 'tail -5 /mnt/us/kindle-screensaver.log'
# 查看 Mac 服务器状态
curl http://localhost:3456/status
```

### SSH 重启后失效
正常重启后 emergency.sh 会自动启动 dropbear。如仍失效，再跑一次 Mesquito → WinterBreak。

### 亚马逊推送 OTA 更新
确认 filler.bin 仍占满空间：
```bash
# USB 挂载后
df -h /Volumes/Kindle  # Avail 应 < 100MB
```
