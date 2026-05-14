'use strict';

const CITY = process.env.WEATHER_CITY || '本地';

/**
 * 渲染 Kindle 屏保专用 HTML（758×1024 px，灰度高对比，供 Puppeteer 截图）
 */
function renderScreensaverPage({ weather, stocks, lastUpdated, notice, error }) {
  const updatedStr = lastUpdated
    ? lastUpdated.toLocaleString('zh-CN', {
        timeZone: process.env.WEATHER_TIMEZONE || 'Asia/Shanghai',
        hour12: false,
        month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      })
    : '--';

  const weatherHTML = renderWeather(weather);
  const stocksHTML = renderStocks(stocks);
  const noticeHTML = notice
    ? `<div class="notice">&#9656; ${escapeHtml(notice)}</div>`
    : '';
  const errorHTML = error
    ? `<div class="error">⚠ ${escapeHtml(error)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 600px;
      height: 800px;
      overflow: hidden;
      background: #ffffff;
      color: #000000;
      /* Puppeteer 截图后用 sharp 转灰度，这里已用高对比设计 */
      font-family: "Noto Sans CJK SC", "Source Han Sans CN", "STSong", "SimSun", Arial, sans-serif;
    }

    .page {
      width: 600px;
      height: 800px;
      display: flex;
      flex-direction: column;
      padding: 14px 18px 12px;
    }

    /* ── 页头 ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 3px solid #000;
      padding-bottom: 8px;
      margin-bottom: 14px;
    }
    .header-city { font-size: 22px; font-weight: 900; letter-spacing: 2px; }
    .header-meta { font-size: 14px; text-align: right; line-height: 1.6; }

    /* ── 通知 ── */
    .notice {
      border: 2px solid #000;
      padding: 8px 12px;
      margin-bottom: 12px;
      font-size: 18px;
      font-weight: bold;
    }
    .error {
      border: 1px dashed #000;
      padding: 6px 10px;
      margin-bottom: 10px;
      font-size: 14px;
    }

    /* ── 区块标题 ── */
    .section-title {
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 3px;
      text-transform: uppercase;
      border-bottom: 1px solid #000;
      padding-bottom: 5px;
      margin-bottom: 10px;
    }

    /* ── 天气 4格 ── */
    .weather-section { margin-bottom: 18px; }
    .weather-grid { display: flex; gap: 8px; }
    .wcard {
      flex: 1;
      border: 2px solid #000;
      padding: 10px 6px;
      text-align: center;
    }
    .wcard.today { background: #000; color: #fff; }
    .wc-label { font-size: 13px; margin-bottom: 4px; font-weight: bold; }
    .wc-cond  { font-size: 16px; font-weight: 900; margin-bottom: 3px; }
    .wc-cur   { font-size: 12px; margin-bottom: 2px; }
    .wc-range { font-size: 14px; font-weight: bold; }
    .wc-rain  { font-size: 12px; margin-top: 4px; }

    /* ── 股票表格 ── */
    .stocks-section { flex: 1; }
    .stock-table { width: 100%; border-collapse: collapse; }
    .stock-table th {
      font-size: 13px;
      font-weight: 900;
      text-align: left;
      border-bottom: 2px solid #000;
      padding: 5px 6px;
      letter-spacing: 1px;
    }
    .stock-table td {
      font-size: 15px;
      padding: 6px 5px;
      border-bottom: 1px solid #bbb;
      vertical-align: middle;
    }
    .col-name  { font-weight: bold; }
    .col-sym   { font-size: 13px; color: #444; }
    .col-price { font-family: monospace; font-size: 16px; text-align: right; font-weight: bold; }
    .col-chg   { font-family: monospace; text-align: right; white-space: nowrap; }
    .col-pct   { font-family: monospace; text-align: right; white-space: nowrap; font-weight: bold; }
    .up   { /* black, bold — already set */ }
    .down { text-decoration: underline; }

    /* ── 页脚 ── */
    .footer {
      font-size: 12px;
      text-align: center;
      border-top: 1px solid #bbb;
      padding-top: 6px;
      margin-top: 8px;
      color: #555;
    }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-city">&#127968; ${escapeHtml(CITY)} &mdash; Dashboard</div>
    <div class="header-meta">更新 ${updatedStr}<br>数据: Open-Meteo · Yahoo</div>
  </div>

  ${noticeHTML}
  ${errorHTML}

  <div class="weather-section">
    <div class="section-title">&#9788; 天气预报</div>
    <div class="weather-grid">${weatherHTML}</div>
  </div>

  <div class="stocks-section">
    <div class="section-title">&#9654; 股票看板</div>
    <table class="stock-table">
      <thead><tr>
        <th>名称</th>
        <th>代码</th>
        <th style="text-align:right">最新价</th>
        <th style="text-align:right">涨跌额</th>
        <th style="text-align:right">涨跌幅</th>
      </tr></thead>
      <tbody>${stocksHTML}</tbody>
    </table>
  </div>

  <div class="footer">kindle-news screensaver &bull; ${updatedStr}</div>
</div>
</body>
</html>`;
}

function renderWeather(days) {
  if (!days || days.length === 0)
    return '<div style="padding:16px">天气数据加载失败</div>';
  return days.map((d) => {
    const cls = d.isToday ? 'wcard today' : 'wcard';
    const cur = d.currentTemp !== null
      ? `<div class="wc-cur">现在 ${d.currentTemp}°C</div>` : '';
    const rain = Number(d.precipitation) > 0
      ? `<div class="wc-rain">雨 ${d.precipitation}mm</div>` : '';
    return `<div class="${cls}">
  <div class="wc-label">${escapeHtml(d.label)}</div>
  <div class="wc-cond">${escapeHtml(d.condition)}</div>
  ${cur}
  <div class="wc-range">${d.maxTemp}° / ${d.minTemp}°</div>
  ${rain}
</div>`;
  }).join('');
}

function renderStocks(stocks) {
  if (!stocks || stocks.length === 0)
    return '<tr><td colspan="5" style="padding:12px;text-align:center">股票数据加载失败</td></tr>';
  return stocks.map((s) => {
    const dir = s.isUp ? 'up' : 'down';
    const arrow = s.isUp ? '&#9650;' : '&#9660;';
    return `<tr>
  <td class="col-name">${escapeHtml(s.name)}</td>
  <td class="col-sym">${escapeHtml(s.symbol)}</td>
  <td class="col-price">${escapeHtml(s.price)}</td>
  <td class="col-chg ${dir}">${arrow}${escapeHtml(s.change)}</td>
  <td class="col-pct ${dir}">${escapeHtml(s.changePercent)}</td>
</tr>`;
  }).join('');
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { renderScreensaverPage };
