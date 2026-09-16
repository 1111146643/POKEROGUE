/* ============================================
   egg-moves.js — 蛋招式孵化解锁判定
   每只宝可梦 4 个蛋招式（3 普通 + 1 稀有），未学会的在孵化时有几率解锁，
   下局游戏可用。稀有招式几率更低，招式 UP 蛋池（poolType='eggUp'）时提升。
   UMD：浏览器挂 PKR.eggMoves，Node 可 module.exports
   ============================================ */
(function (root) {
  'use strict';

  const defaults = {
    common: 0.20,      // 普通蛋招式解锁几率
    rare: 0.05,        // 稀有蛋招式解锁几率
    eggUpCommon: 0.40, // 招式 UP 蛋池：普通
    eggUpRare: 0.15    // 招式 UP 蛋池：稀有
  };

  /* 返回本次孵化新解锁的招式 id 列表。逐槽独立判定。
     species: { eggMoves: [moveId×4], eggRareIdx }
     alreadyUnlocked: 已解锁的招式 id 列表 */
  function rollUnlock({ species, alreadyUnlocked = [], poolType = 'standard', rates = defaults, rng = Math.random } = {}) {
    const eggUp = poolType === 'eggUp';
    const commonRate = eggUp ? rates.eggUpCommon : rates.common;
    const rareRate = eggUp ? rates.eggUpRare : rates.rare;
    const unlocked = new Set(alreadyUnlocked);
    const newly = [];
    (species.eggMoves || []).forEach((moveId, i) => {
      if (unlocked.has(moveId)) return;
      const rate = i === species.eggRareIdx ? rareRate : commonRate;
      if (rng() < rate) { newly.push(moveId); unlocked.add(moveId); }
    });
    return newly;
  }

  const api = { defaults, rollUnlock };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PKR = root.PKR || {}; root.PKR.eggMoves = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
