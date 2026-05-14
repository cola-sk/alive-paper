'use strict';

const axios = require('axios');

const LAT = process.env.WEATHER_LAT || '31.23';
const LON = process.env.WEATHER_LON || '121.47';
const TIMEZONE = process.env.WEATHER_TIMEZONE || 'Asia/Shanghai';

// WMO 天气代码 → 中文描述
const WMO_CODES = {
  0: '晴',
  1: '晴间多云', 2: '多云', 3: '阴',
  45: '雾', 48: '冻雾',
  51: '小毛毛雨', 53: '毛毛雨', 55: '大毛毛雨',
  56: '冻毛毛雨', 57: '强冻毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨',
  66: '冻雨', 67: '强冻雨',
  71: '小雪', 73: '中雪', 75: '大雪', 77: '冰粒',
  80: '阵雨', 81: '中阵雨', 82: '强阵雨',
  85: '阵雪', 86: '强阵雪',
  95: '雷阵雨', 96: '雷阵雨伴冰雹', 99: '强雷阵雨',
};

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * 获取未来 4 天天气预报
 * @returns {Promise<Array<{label, date, maxTemp, minTemp, condition, precipitation}>>}
 */
async function getWeather() {
  const url = [
    'https://api.open-meteo.com/v1/forecast',
    `?latitude=${LAT}&longitude=${LON}`,
    `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum`,
    `&current=temperature_2m,weather_code`,
    `&timezone=${encodeURIComponent(TIMEZONE)}`,
    `&forecast_days=4`,
  ].join('');

  const { data } = await axios.get(url, { timeout: 10000 });
  const { daily, current } = data;

  return daily.time.map((dateStr, i) => {
    const d = new Date(dateStr);
    let label;
    if (i === 0) label = `今天 (${WEEKDAYS[d.getDay()]})`;
    else if (i === 1) label = `明天 (${WEEKDAYS[d.getDay()]})`;
    else if (i === 2) label = `后天 (${WEEKDAYS[d.getDay()]})`;
    else label = `${dateStr.slice(5)} (${WEEKDAYS[d.getDay()]})`;

    return {
      label,
      date: dateStr,
      isToday: i === 0,
      currentTemp: i === 0 ? Math.round(current.temperature_2m) : null,
      maxTemp: Math.round(daily.temperature_2m_max[i]),
      minTemp: Math.round(daily.temperature_2m_min[i]),
      condition: WMO_CODES[daily.weather_code[i]] ?? '未知',
      precipitation: Number(daily.precipitation_sum[i] ?? 0).toFixed(1),
    };
  });
}

module.exports = { getWeather };
