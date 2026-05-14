'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const { getWeather } = require('./src/services/weather');
const { getStocks } = require('./src/services/stocks');
const { renderKindlePage } = require('./src/template');
const { renderScreensaverPage } = require('./src/screensaver-template');
const { generateScreenshot, OUTPUT_PATH } = require('./src/services/screenshot');

const app = express();
app.use(express.json());

// 静态目录：public/screensaver.png 供 Kindle 直接下载
app.use('/public', express.static(path.join(__dirname, 'public')));

const PORT = parseInt(process.env.PORT || '3000', 10);
const REFRESH_INTERVAL = parseInt(process.env.REFRESH_INTERVAL || '900', 10);
const SCREENSHOT_INTERVAL_MIN = parseInt(process.env.SCREENSHOT_INTERVAL_MIN || '30', 10);
const CACHE_TTL_MS = REFRESH_INTERVAL * 1000;

// ─── 内存缓存 ─────────────────────────────────────────────────────
let cache = {
  weather: null,
  stocks: null,
  lastUpdated: null,
  notice: null,   // 通过 POST /push 写入的自定义通知
  error: null,
};

async function refreshData() {
  try {
    const [weather, stocks] = await Promise.allSettled([getWeather(), getStocks()]);
    cache.weather = weather.status === 'fulfilled' ? weather.value : cache.weather;
    cache.stocks  = stocks.status  === 'fulfilled' ? stocks.value  : cache.stocks;
    cache.lastUpdated = new Date();
    cache.error = null;
    console.log(`[${cache.lastUpdated.toISOString()}] 数据刷新成功`);
  } catch (err) {
    cache.error = `数据刷新失败: ${err.message}`;
    console.error(cache.error);
  }
}

// ─── 路由 ─────────────────────────────────────────────────────────

/**
 * GET /
 * Kindle 浏览器访问此页面，自动每 REFRESH_INTERVAL 秒刷新
 */
app.get('/', async (req, res) => {
  const now = Date.now();
  const stale = !cache.lastUpdated || (now - cache.lastUpdated.getTime()) > CACHE_TTL_MS;

  if (stale) {
    await refreshData();
  }

  const html = renderKindlePage({
    weather: cache.weather || [],
    stocks: cache.stocks || [],
    lastUpdated: cache.lastUpdated,
    notice: cache.notice,
    refreshInterval: REFRESH_INTERVAL,
    error: cache.error,
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

/**
 * POST /push
 * 从远端推送自定义通知消息，Kindle 下次刷新时展示
 * Body: { "message": "今日午饭提醒：会议室有订餐" }
 * 可选: { "ttl": 3600 }  // 通知存活秒数，默认一直显示直到下次推送
 */
app.post('/push', (req, res) => {
  const { message, ttl } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message 字段必填，且必须为字符串' });
  }
  if (message.length > 200) {
    return res.status(400).json({ error: 'message 不得超过 200 个字符' });
  }

  cache.notice = message.trim();

  if (ttl && Number.isFinite(Number(ttl)) && Number(ttl) > 0) {
    setTimeout(() => { cache.notice = null; }, Number(ttl) * 1000);
  }

  console.log(`[push] 通知已设置: "${cache.notice}"`);
  res.json({ ok: true, notice: cache.notice });
});

/**
 * DELETE /push
 * 清除当前通知
 */
app.delete('/push', (req, res) => {
  cache.notice = null;
  res.json({ ok: true });
});

/**
 * POST /refresh
 * 强制立即刷新数据缓存
 */
app.post('/refresh', async (req, res) => {
  await refreshData();
  res.json({ ok: true, lastUpdated: cache.lastUpdated });
});

/**
 * GET /status
 * 查看当前缓存状态（调试用）
 */
app.get('/status', (req, res) => {
  res.json({
    lastUpdated: cache.lastUpdated,
    hasWeather: Array.isArray(cache.weather) && cache.weather.length > 0,
    hasStocks: Array.isArray(cache.stocks) && cache.stocks.length > 0,
    notice: cache.notice,
    error: cache.error,
    refreshInterval: REFRESH_INTERVAL,
    screenshotIntervalMin: SCREENSHOT_INTERVAL_MIN,
  });
});

/**
 * GET /screensaver-src
 * 仅供 Puppeteer 截图用的内部页面（758×1024，灰度优化）
 * 普通用户也可在浏览器预览效果
 */
app.get('/screensaver-src', async (req, res) => {
  const now = Date.now();
  const stale = !cache.lastUpdated || (now - cache.lastUpdated.getTime()) > CACHE_TTL_MS;
  if (stale) await refreshData();

  const html = renderScreensaverPage({
    weather: cache.weather || [],
    stocks: cache.stocks || [],
    lastUpdated: cache.lastUpdated,
    notice: cache.notice,
    error: cache.error,
  });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

/**
 * GET /screensaver.png
 * 直接返回最新屏保 PNG（供 Kindle 越狱后的 cron/wget 下载）
 * 若文件不存在则先生成
 */
app.get('/screensaver.png', async (req, res) => {
  const fs = require('fs');
  const staleThresholdMs = SCREENSHOT_INTERVAL_MIN * 60 * 1000;
  const needRegen = !fs.existsSync(OUTPUT_PATH) ||
    (Date.now() - fs.statSync(OUTPUT_PATH).mtimeMs) > staleThresholdMs;

  if (needRegen) {
    try {
      await generateScreenshot(PORT);
    } catch (err) {
      console.error('[screensaver.png] 生成失败:', err.message);
      if (!fs.existsSync(OUTPUT_PATH)) {
        return res.status(503).json({ error: '截图生成失败: ' + err.message });
      }
    }
  }

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(OUTPUT_PATH);
});

/**
 * POST /screenshot
 * 手动触发立即重新生成屏保截图
 */
app.post('/screenshot', async (req, res) => {
  try {
    await refreshData();
    await generateScreenshot(PORT);
    res.json({ ok: true, path: '/screensaver.png' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 启动 ─────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`Kindle Dashboard 运行中 → http://localhost:${PORT}`);
  console.log(`  GET  /                   Kindle 浏览器页面`);
  console.log(`  GET  /screensaver.png    屏保图片 (Kindle 越狱后 cron wget 下载)`);
  console.log(`  POST /push               推送通知`);
  console.log(`  POST /refresh            刷新数据`);
  console.log(`  POST /screenshot         立即重生成截图`);

  // 启动时立即拉取一次数据
  await refreshData();

  // 启动后生成第一张屏保
  if (SCREENSHOT_INTERVAL_MIN > 0) {
    try {
      await generateScreenshot(PORT);
    } catch (err) {
      console.warn('[startup] 初始截图失败 (puppeteer 未安装?):', err.message);
    }

    // 定时自动截图
    setInterval(async () => {
      try {
        await refreshData();
        await generateScreenshot(PORT);
      } catch (err) {
        console.error('[cron] 截图失败:', err.message);
      }
    }, SCREENSHOT_INTERVAL_MIN * 60 * 1000);

    console.log(`定时截图: 每 ${SCREENSHOT_INTERVAL_MIN} 分钟自动更新 /screensaver.png`);
  }
});
