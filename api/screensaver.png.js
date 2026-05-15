'use strict';

// Chromium 不在 Vercel serverless 上运行。
// 截图由 Mac 本地 server.js 生成，生成后上传到 Vercel Blob；
// 此函数仅重定向到 Blob CDN URL，不启动浏览器。
const { getPngUrl } = require('../src/services/blob-store');

module.exports = async (req, res) => {
  try {
    const url = await getPngUrl();
    if (url) {
      res.setHeader('Cache-Control', 'no-cache');
      return res.redirect(302, url);
    }
    // Mac 尚未上传截图（服务未启动或 Blob token 未配置）
    return res.status(503).json({
      error: 'Screenshot not yet available. Start the Mac server to generate one.',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
