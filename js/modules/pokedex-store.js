/* ============================================
   pokedex-store.js — 存档读写（浏览器专用，经 PKR.storage 安全封装）
   键：pkrogue.candies（账号级糖果）/ pkrogue.eggUnlocks（已解锁蛋招式）
       pkrogue.individuals（个体档案）/ pkrogue.caught（捕获登记，预留）
   ============================================ */
(function (root) {
  'use strict';

  function readJSON(key, fallback) {
    try {
      const raw = root.PKR.storage.get(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.warn('[PokedexStore] 读取失败，使用默认值：', key, err);
      return fallback;
    }
  }
  function writeJSON(key, value) {
    try { root.PKR.storage.set(key, JSON.stringify(value)); }
    catch (err) { console.warn('[PokedexStore] 写入失败：', key, err); }
  }

  const api = {
    /* ---------- 糖果（账号级，按物种累计） ---------- */
    getCandies() { return readJSON('pkrogue.candies', {}); },
    getCandy(speciesId) { return this.getCandies()[speciesId] || 0; },
    addCandies(speciesId, n) {
      const all = this.getCandies();
      all[speciesId] = (all[speciesId] || 0) + n;
      writeJSON('pkrogue.candies', all);
      return all[speciesId];
    },

    /* ---------- 已解锁蛋招式（账号级，下局可用） ---------- */
    getEggUnlocks(speciesId) {
      return readJSON('pkrogue.eggUnlocks', {})[speciesId] || [];
    },
    unlockEggMoves(speciesId, moveIds) {
      const all = readJSON('pkrogue.eggUnlocks', {});
      const set = new Set(all[speciesId] || []);
      moveIds.forEach(m => set.add(m));
      all[speciesId] = [...set];
      writeJSON('pkrogue.eggUnlocks', all);
      return all[speciesId];
    },

    /* ---------- 个体档案（按物种分组） ---------- */
    getIndividuals(speciesId) {
      return readJSON('pkrogue.individuals', {})[speciesId] || [];
    },
    saveIndividual(ind) {
      const all = readJSON('pkrogue.individuals', {});
      const list = all[ind.speciesId] || [];
      const idx = list.findIndex(x => x.uid === ind.uid);
      if (idx >= 0) list[idx] = ind; else list.push(ind);
      all[ind.speciesId] = list;
      writeJSON('pkrogue.individuals', all);
    },

    /* ---------- 捕获登记（预留：记录最高闪光 tier） ---------- */
    getCaught(speciesId) {
      return readJSON('pkrogue.caught', {})[speciesId] || null;
    },
    markCaught(speciesId, shinyTier = 0) {
      const all = readJSON('pkrogue.caught', {});
      const prev = all[speciesId];
      if (!prev || prev.shiny < shinyTier) all[speciesId] = { shiny: shinyTier };
      writeJSON('pkrogue.caught', all);
    }
  };

  root.PKR = root.PKR || {};
  root.PKR.PokedexStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
