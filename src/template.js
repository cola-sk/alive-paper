'use strict';

const CITY = process.env.WEATHER_CITY || '本地';

/**
 * 渲染 Kindle e-ink 优化的 HTML 页面
 * @param {object} params
 * @param {Array}  params.weather   - 天气数据数组
 * @param {Array}  params.stocks    - 股票数据数组
 * @param {Date}   params.lastUpdated - 最后更新时间
 * @param {string|null} params.notice - 推送的自定义通知
 * @param {number} params.refreshInterval - 自动刷新秒数
 * @param {string} params.error     - 错误信息（可选）
 */
function renderKindlePage({ weather, stocks, lastUpdated, notice, refreshInterval, error }) {
  const updatedStr = lastUpdated
    ? lastUpdated.toLocaleString('zh-CN', { timeZone: process.env.WEATHER_TIMEZONE || 'Asia/Shanghai', hour12: false })
    : '--';

  const weatherHTML = renderWeather(weather);
  const stocksHTML = renderStocks(stocks);
  const noticeHTML = notice
    ? `<div class="notice">&#128241; ${escapeHtml(notice)}</div>`
    : '';
  const errorHTML = error
    ? `<div class="error">⚠ ${escapeHtml(error)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=600, initial-scale=1">
  <meta http-equiv="refresh" content="${refreshInterval}">
  <title>Kindle Dashboard</title>
  <style>
    /* === 基础重置：e-ink 黑白高对比 === */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "STSong", "SimSun", Georgia, serif;
      background: #ffffff;
      color: #000000;
      width: 600px;
      padding: 8px 10px;
      font-size: 14px;
      line-height: 1.4;
    }

    /* === 页头 === */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 2px solid #000;
      padding-bottom: 4px;
      margin-bottom: 6px;
    }
    .header-title { font-size: 17px; font-weight: bold; }
    .header-meta { font-size: 11px; text-align: right; }

    /* === 通知条 === */
    .notice {
      border: 2px solid #000;
      padding: 5px 8px;
      margin-bottom: 8px;
      font-size: 13px;
      font-weight: bold;
    }
    .error {
      border: 1px dashed #000;
      padding: 4px 8px;
      margin-bottom: 8px;
      font-size: 12px;
    }

    /* === 区块标题 === */
    .section-title {
      font-size: 13px;
      font-weight: bold;
      border-bottom: 1px solid #000;
      margin-bottom: 6px;
      padding-bottom: 2px;
      letter-spacing: 1px;
    }

    /* === 天气：四格横排 === */
    .weather-grid {
      display: flex;
      gap: 6px;
      margin-bottom: 12px;
    }
    .weather-card {
      flex: 1;
      border: 1px solid #000;
      padding: 6px 4px;
      text-align: center;
    }
    .weather-card.today {
      background: #000;
      color: #fff;
    }
    .wc-label { font-size: 11px; margin-bottom: 3px; }
    .wc-condition { font-size: 13px; font-weight: bold; margin-bottom: 3px; }
    .wc-temp { font-size: 14px; }
    .wc-cur { font-size: 11px; margin-bottom: 2px; }
    .wc-precip { font-size: 10px; margin-top: 3px; }

    /* === 股票表格 === */
    .stock-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .stock-table th {
      font-size: 11px;
      font-weight: bold;
      text-align: left;
      border-bottom: 1px solid #000;
      padding: 3px 4px;
    }
    .stock-table td {
      font-size: 13px;
      padding: 5px 4px;
      border-bottom: 1px solid #ccc;
      vertical-align: middle;
    }
    .stock-table td.price { font-family: monospace; font-size: 14px; text-align: right; }
    .stock-table td.change { font-family: monospace; text-align: right; white-space: nowrap; }
    .up   { font-weight: bold; }
    .down { font-style: italic; }

    /* === 页脚 === */
    .footer {
      font-size: 10px;
      text-align: center;
      border-top: 1px solid #ccc;
      padding-top: 4px;
      margin-top: 6px;
      color: #444;
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="header-title">&#128218; Kindle Dashboard &middot; ${escapeHtml(CITY)}</span>
    <span class="header-meta">更新: ${updatedStr}<br>${refreshInterval / 60} 分钟自动刷新</span>
  </div>

  ${noticeHTML}
  ${errorHTML}

  <div class="section-title">&#9728; 天气预报</div>
  <div class="weather-grid">${weatherHTML}</div>

  <div class="section-title">&#9654; 股票看板</div>
  <table class="stock-table">
    <thead>
      <tr>
        <th>名称</th>
        <th>代码</th>
        <th style="text-align:right">价格</th>
        <th style="text-align:right">涨跌额</th>
        <th style="text-align:right">涨跌幅</th>
      </tr>
    </thead>
    <tbody>${stocksHTML}</tbody>
  </table>

  <div class="footer">kindle-news &bull; 每 ${refreshInterval / 60} 分钟自动更新 &bull; 数据来源: Open-Meteo / Yahoo Finance</div>
</body>
</html>`;
}

// ─── 子渲染函数 ────────────────────────────────────────────────────

function renderWeather(days) {
  if (!days || days.length === 0) {
    return '<div style="padding:10px">天气数据加载失败，请稍后刷新</div>';
  }
  return days.map((d) => {
    const cls = d.isToday ? 'weather-card today' : 'weather-card';
    const curLine = d.currentTemp !== null
      ? `<div class="wc-cur">现在 ${d.currentTemp}°C</div>` : '';
    const precipLine = Number(d.precipitation) > 0
      ? `<div class="wc-precip">降水 ${d.precipitation}mm</div>` : '';

    return `<div class="${cls}">
  <div class="wc-label">${escapeHtml(d.label)}</div>
  <div class="wc-condition">${escapeHtml(d.condition)}</div>
  ${curLine}
  <div class="wc-temp">${d.maxTemp}° / ${d.minTemp}°</div>
  ${precipLine}
</div>`;
  }).join('\n');
}

function renderStocks(stocks) {
  if (!stocks || stocks.length === 0) {
    return '<tr><td colspan="5" style="padding:8px;text-align:center">股票数据加载失败</td></tr>';
  }
  return stocks.map((s) => {
    const dir = s.isUp ? 'up' : 'down';
    const arrow = s.isUp ? '&#9650;' : '&#9660;'; // ▲ ▼
    return `<tr>
  <td>${escapeHtml(s.name)}</td>
  <td style="font-size:11px;color:#444">${escapeHtml(s.symbol)}</td>
  <td class="price">${escapeHtml(s.price)}</td>
  <td class="change ${dir}">${arrow} ${escapeHtml(s.change)}</td>
  <td class="change ${dir}">${escapeHtml(s.changePercent)}</td>
</tr>`;
  }).join('\n');
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { renderKindlePage };
