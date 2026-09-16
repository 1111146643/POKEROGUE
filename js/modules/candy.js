/* ============================================
   candy.js — 糖果系统：捕捉/孵化基础值与 Boss/闪光倍率、好感度进度
   UMD：浏览器挂 PKR.candy，Node 可 module.exports
   ============================================ */
(function (root) {
  'use strict';

  /* 基础规则（配置可整体覆盖）：
     捕捉 +1、孵化 +2；Boss ×2；黄闪 ×5、蓝闪 ×10、红闪 ×20（倍率相乘） */
  const defaults = {
    catchBase: 1,
    hatchBase: 2,
    bossMult: 2,
    shinyMult: [1, 5, 10, 20] // [普通, 黄闪, 蓝闪, 红闪]
  };

  function calcCandy({ method = 'catch', isBoss = false, shiny = 0, mult = defaults } = {}) {
    const base = method === 'hatch' ? mult.hatchBase : mult.catchBase;
    return base * (isBoss ? mult.bossMult : 1) * mult.shinyMult[shiny];
  }

  /* 好感度进度（UI 糖果图标填充用） */
  function friendshipProgress(friendship, max = 255) {
    const v = Math.min(Math.max(0, friendship), max);
    return { full: v >= max, remain: max - v, ratio: v / max };
  }

  /* 好感度满值换糖果：返回获得糖果数与剩余好感度 */
  function consumeFriendship(friendship, max = 255) {
    const v = Math.max(0, Math.floor(friendship));
    return { candy: Math.floor(v / max), remainFriendship: v % max };
  }

  const api = { defaults, calcCandy, friendshipProgress, consumeFriendship };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PKR = root.PKR || {}; root.PKR.candy = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
