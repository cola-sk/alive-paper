'use strict';

/**
 * 截图服务：用 Puppeteer 渲染 /screensaver-src 页面，
 * 用 sharp 转换为 758×1024 灰度 PNG，写入 public/screensaver.png
 *
 * Kindle 越狱后的 cron 脚本只需：
 *   wget -q http://your-server:3000/screensaver.png -O /mnt/us/linkss/screensavers/dashboard.png
 */

const path = require('path');
const fs = require('fs');

// public 目录
const PUBLIC_DIR = path.join(__dirname, '../../public');
const OUTPUT_PATH = path.join(PUBLIC_DIR, 'screensaver.png');

// Kindle 8代基础款分辨率 (600×800, 167 PPI)
const KINDLE_W = 600;
const KINDLE_H = 800;

let puppeteer, sharp;
try {
  puppeteer = require('puppeteer');
  sharp = require('sharp');
} catch (e) {
  console.warn('[screenshot] puppeteer 或 sharp 未安装，截图功能不可用:', e.message);
}

/**
 * 生成屏保截图
 * @param {number} port - 本服务监听的端口（用于访问 /screensaver-src）
 * @returns {Promise<string>} 输出文件路径
 */
async function generateScreenshot(port) {
  if (!puppeteer || !sharp) {
    throw new Error('依赖未安装，运行 npm install 后重试');
  }

  // 确保 public 目录存在
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: true,
    // 优先用系统 Chrome，其次用 Puppeteer 自带版本
    executablePath: resolveChromePath(),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: KINDLE_W, height: KINDLE_H, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${port}/screensaver-src`, {
      waitUntil: 'networkidle0',
      timeout: 15000,
    });

    const rawPng = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: KINDLE_W, height: KINDLE_H } });

    // 转换为灰度 PNG（e-ink 最佳效果）
    await sharp(rawPng)
      .grayscale()
      .png({ compressionLevel: 6 })
      .toFile(OUTPUT_PATH);

    console.log(`[screenshot] 屏保已生成 → ${OUTPUT_PATH}`);
    return OUTPUT_PATH;
  } finally {
    await browser.close();
  }
}

module.exports = { generateScreenshot, OUTPUT_PATH };

// ─── 工具函数 ──────────────────────────────────────────────────────

function resolveChromePath() {
  // 按优先级查找可用的 Chrome/Chromium
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return undefined; // 回退到 puppeteer 内置
}
