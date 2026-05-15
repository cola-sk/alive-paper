'use strict';

const { generateScreenshotBuffer } = require('../../src/services/screenshot');
const { uploadPng } = require('../../src/services/blob-store');

module.exports = async (req, res) => {
  try {
    const expected = process.env.CRON_SECRET;
    if (expected) {
      const auth = req.headers.authorization || '';
      if (auth !== `Bearer ${expected}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const pngBuffer = await generateScreenshotBuffer();
    const url = await uploadPng(pngBuffer);

    return res.status(200).json({
      ok: true,
      size: pngBuffer.length,
      url: url || null,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
