'use strict';

const axios = require('axios');

const RAW_SYMBOLS = process.env.STOCK_SYMBOLS || '^GSPC,0700.HK,600519.SS';

/**
 * 批量获取股票行情
 * @returns {Promise<Array<{symbol, name, price, change, changePercent, currency, market}>>}
 */
async function getStocks() {
  const symbols = RAW_SYMBOLS.split(',').map((s) => s.trim()).filter(Boolean);
  const results = await Promise.allSettled(symbols.map(fetchStock));

  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
}

async function fetchStock(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

  const { data } = await axios.get(url, {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: 'application/json',
    },
  });

  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No data for ${symbol}`);

  const meta = result.meta;
  const price = meta.regularMarketPrice ?? 0;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
  const change = price - prevClose;
  const changePct = prevClose !== 0 ? (change / prevClose) * 100 : 0;

  return {
    symbol: meta.symbol,
    name: meta.shortName || meta.longName || meta.symbol,
    price: formatPrice(price, meta.currency),
    change: change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2),
    changePercent: changePct >= 0 ? `+${changePct.toFixed(2)}%` : `${changePct.toFixed(2)}%`,
    isUp: change >= 0,
    currency: meta.currency || '',
  };
}

function formatPrice(price, currency) {
  if (price >= 1000) return price.toFixed(2);
  if (price >= 10) return price.toFixed(2);
  return price.toFixed(3);
}

module.exports = { getStocks };
