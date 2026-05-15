'use strict';

const { generateScreenshotBuffer } = require('../src/services/screenshot');
const { getPngUrl, uploadPng } = require('../src/services/blob-store');

module.exports = async (req, res) => {
  try {
    const latestUrl = await getPngUrl();

    // 优先使用已生成的 Blob 文件，避免每次请求都跑截图。
    if (latestUrl) {
      res.setHeader('Cache-Control', 'no-cache');
      return res.redirect(302, latestUrl);
    }

    // 首次没有缓存时按请求即时生成一次。
    const pngBuffer = await generateScreenshotBuffer();
    await uploadPng(pngBuffer);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).send(pngBuffer);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
