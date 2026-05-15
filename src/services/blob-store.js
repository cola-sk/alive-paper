'use strict';

let vercelBlob;
try {
  vercelBlob = require('@vercel/blob');
} catch (e) {
  vercelBlob = null;
}

const BLOB_PATH = process.env.SCREENSHOT_BLOB_PATH || 'kindle-news/screensaver.png';

function isBlobEnabled() {
  return Boolean(vercelBlob && process.env.BLOB_READ_WRITE_TOKEN);
}

async function uploadPng(buffer) {
  if (!isBlobEnabled()) return null;

  const { put } = vercelBlob;
  const result = await put(BLOB_PATH, buffer, {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'image/png',
    cacheControlMaxAge: 60,
  });
  return result.url;
}

async function getPngUrl() {
  if (!isBlobEnabled()) return null;

  const { head } = vercelBlob;
  try {
    const info = await head(BLOB_PATH);
    return info.url;
  } catch (err) {
    return null;
  }
}

module.exports = {
  BLOB_PATH,
  isBlobEnabled,
  uploadPng,
  getPngUrl,
};
