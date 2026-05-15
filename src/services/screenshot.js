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
const { renderScreensaverPage } = require('../screensaver-template');
const { getWeather } = require('./weather');
const { getStocks } = require('./stocks');

// public 目录
const PUBLIC_DIR = path.join(__dirname, '../../public');
const OUTPUT_PATH = path.join(PUBLIC_DIR, 'screensaver.png');

// Kindle 8代基础款分辨率 (600×800, 167 PPI)
const KINDLE_W = 600;
const KINDLE_H = 800;

let puppeteer, sharp, chromium;
try {
  // 优先使用 puppeteer-core（体积小，Vercel 友好），回退到 puppeteer（本地开发）
  try {
    puppeteer = require('puppeteer-core');
  } catch (e) {
    puppeteer = require('puppeteer');
  }
  sharp = require('sharp');
} catch (e) {
  console.warn('[screenshot] puppeteer 或 sharp 未安装，截图功能不可用:', e.message);
}

try {
  chromium = require('@sparticuz/chromium');
} catch (e) {
  chromium = null;
}

/**
 * 生成屏保截图到本地文件
 * @param {object} input
 * @param {Array} [input.weather]
 * @param {Array} [input.stocks]
 * @param {Date}  [input.lastUpdated]
 * @param {string|null} [input.notice]
 * @param {string|null} [input.error]
 * @returns {Promise<string>} 输出文件路径
 */
async function generateScreenshot(input = {}) {
  const pngBuffer = await generateScreenshotBuffer(input);

  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  await fs.promises.writeFile(OUTPUT_PATH, pngBuffer);
  console.log(`[screenshot] 屏保已生成 → ${OUTPUT_PATH}`);
  return OUTPUT_PATH;
}

/**
 * 生成屏保 PNG Buffer（用于 Vercel API/cron）
 * @param {object} input
 * @returns {Promise<Buffer>}
 */
async function generateScreenshotBuffer(input = {}) {
  if (!puppeteer || !sharp) {
    throw new Error('依赖未安装，运行 npm install 后重试');
  }

  const data = await resolveInputData(input);
  const html = renderScreensaverPage(data);

  const launchOptions = await getBrowserLaunchOptions();
  const browser = await puppeteer.launch(launchOptions);


  try {
    const page = await browser.newPage();
    await page.setViewport({ width: KINDLE_W, height: KINDLE_H, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
    // 等待字体等同步渲染完成
    await new Promise((r) => setTimeout(r, 500));

    const rawPng = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: KINDLE_W, height: KINDLE_H } });

    // 转换为灰度 PNG（e-ink 最佳效果）
    return sharp(rawPng)
      .grayscale()
      .png({ compressionLevel: 6 })
      .toBuffer();
  } finally {
    await browser.close();
  }
}

module.exports = { generateScreenshot, generateScreenshotBuffer, OUTPUT_PATH };

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
  // 加入 puppeteer 自管理的 Chrome（npm install puppeteer 时下载的）
  try {
    const p = require('puppeteer');
    if (typeof p.executablePath === 'function') {
      candidates.push(p.executablePath());
    }
  } catch (_) {}
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return undefined;
}

async function getBrowserLaunchOptions() {
  const isVercel = Boolean(process.env.VERCEL) || process.env.SCREENSHOT_RUNTIME === 'vercel';

  // 在 Vercel 上优先使用 serverless chromium
  if (isVercel && chromium) {
    const executablePath = await chromium.executablePath();
    return {
      headless: true,
      executablePath,
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
    };
  }

  return {
    headless: true,
    // 优先用系统 Chrome，其次用 Puppeteer 自带版本
    executablePath: resolveChromePath(),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  };
}

async function resolveInputData(input) {
  if (input.weather && input.stocks) {
    return {
      weather: input.weather,
      stocks: input.stocks,
      lastUpdated: input.lastUpdated || new Date(),
      notice: input.notice || null,
      error: input.error || null,
    };
  }

  const [weatherResult, stocksResult] = await Promise.allSettled([getWeather(), getStocks()]);
  const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : [];
  const stocks = stocksResult.status === 'fulfilled' ? stocksResult.value : [];
  const error = [weatherResult, stocksResult]
    .filter((r) => r.status === 'rejected')
    .map((r) => r.reason?.message || 'unknown error')
    .join('; ') || null;

  return {
    weather,
    stocks,
    lastUpdated: new Date(),
    notice: null,
    error,
  };
}
