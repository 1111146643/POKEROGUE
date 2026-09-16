/* ============================================
   individual.js — 宝可梦个体实例生成：IV / 性格 / 闪光判定
   闪光三档：黄闪（次等稀有）、蓝闪、红闪（最稀有）
   UMD：浏览器挂 PKR.individual，Node 可 module.exports
   ============================================ */
(function (root) {
  'use strict';

  /* 闪光 tier 枚举：0 普通 / 1 黄闪 / 2 蓝闪 / 3 红闪 */
  const SHINY = { NONE: 0, YELLOW: 1, BLUE: 2, RED: 3 };

  const defaultRates = { yellow: 1 / 256, blue: 1 / 2048, red: 1 / 8192 };

  /* 级联判定：先红闪，再蓝闪，再黄闪，否则普通 */
  function rollShiny(rates = defaultRates, rng = Math.random) {
    if (rng() < rates.red) return SHINY.RED;
    if (rng() < rates.blue) return SHINY.BLUE;
    if (rng() < rates.yellow) return SHINY.YELLOW;
    return SHINY.NONE;
  }

  function generateUid(rng = Math.random) {
    return 'ind-' + Math.floor(rng() * 0xffffffff).toString(36) + Math.floor(rng() * 0xffffffff).toString(36);
  }

  function rollIv(rng) {
    const roll = () => Math.floor(rng() * 32); // 0-31
    return { hp: roll(), atk: roll(), def: roll(), spa: roll(), spd: roll(), spe: roll() };
  }

  const ZERO_EV = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

  /* 生成个体实例（纯函数，不写存档）。baseHappiness 由调用方从 species 传入。 */
  function create({ speciesId, level = 1, baseHappiness = 50, obtained = null, rng = Math.random, rates = defaultRates } = {}) {
    return {
      uid: generateUid(rng),
      speciesId,
      shiny: rollShiny(rates, rng),
      level,
      iv: rollIv(rng),
      nature: Math.floor(rng() * 25),
      ev: { ...ZERO_EV },
      friendship: Math.min(255, Math.max(0, baseHappiness)), // 初始好感度 = 种族基准
      obtained,
      obtainedAt: new Date().toISOString()
    };
  }

  const api = { SHINY, defaultRates, rollShiny, generateUid, create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PKR = root.PKR || {}; root.PKR.individual = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
