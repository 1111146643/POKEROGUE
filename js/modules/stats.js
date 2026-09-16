/* ============================================
   stats.js — 属性计算：官方公式 + 25 种性格表
   UMD：浏览器挂 PKR.stats，Node 可 module.exports
   ============================================ */
(function (root) {
  'use strict';

  /* 六维下标约定：0 物攻 1 物防 2 特攻 3 特防 4 速度（HP 不受性格影响） */
  const ATK = 0, DEF = 1, SPA = 2, SPD = 3, SPE = 4;

  /* 25 种性格（官方顺序，下标 0-24） */
  const NATURES = [
    { en: 'hardy', zh: '勤奋', up: null, down: null },
    { en: 'lonely', zh: '怕寂寞', up: ATK, down: DEF },
    { en: 'brave', zh: '勇敢', up: ATK, down: SPE },
    { en: 'adamant', zh: '固执', up: ATK, down: SPA },
    { en: 'naughty', zh: '顽皮', up: ATK, down: SPD },
    { en: 'bold', zh: '大胆', up: DEF, down: ATK },
    { en: 'docile', zh: '坦率', up: null, down: null },
    { en: 'relaxed', zh: '悠闲', up: DEF, down: SPE },
    { en: 'impish', zh: '淘气', up: DEF, down: SPA },
    { en: 'lax', zh: '乐天', up: DEF, down: SPD },
    { en: 'timid', zh: '胆小', up: SPE, down: ATK },
    { en: 'hasty', zh: '急躁', up: SPE, down: DEF },
    { en: 'serious', zh: '认真', up: null, down: null },
    { en: 'jolly', zh: '爽朗', up: SPE, down: SPA },
    { en: 'naive', zh: '天真', up: SPE, down: SPD },
    { en: 'modest', zh: '内敛', up: SPA, down: ATK },
    { en: 'mild', zh: '慢吞吞', up: SPA, down: DEF },
    { en: 'quiet', zh: '冷静', up: SPA, down: SPE },
    { en: 'bashful', zh: '害羞', up: null, down: null },
    { en: 'rash', zh: '马虎', up: SPA, down: SPD },
    { en: 'calm', zh: '温和', up: SPD, down: ATK },
    { en: 'gentle', zh: '温顺', up: SPD, down: DEF },
    { en: 'sassy', zh: '自大', up: SPD, down: SPE },
    { en: 'careful', zh: '慎重', up: SPD, down: SPA },
    { en: 'quirky', zh: '浮躁', up: null, down: null }
  ];

  /* statIdx：0-4 五维下标（HP 传任意值均返回 1） */
  function natureMult(natureIdx, statIdx) {
    const n = NATURES[natureIdx];
    if (!n) return 1;
    if (n.up === statIdx) return 1.1;
    if (n.down === statIdx) return 0.9;
    return 1;
  }

  const ZERO_EV = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

  /* 官方属性公式：
     HP  = floor((2·base + iv + floor(ev/4)) · level / 100) + level + 10
     其余 = floor((floor((2·base + iv + floor(ev/4)) · level / 100) + 5) · 性格修正) */
  function calcStats({ base, iv, ev = ZERO_EV, level = 50, nature = 12 }) {
    const calc = (b, i, e) => Math.floor((2 * b + i + Math.floor(e / 4)) * level / 100);
    return {
      hp: calc(base.hp, iv.hp, ev.hp) + level + 10,
      atk: Math.floor((calc(base.atk, iv.atk, ev.atk) + 5) * natureMult(nature, ATK)),
      def: Math.floor((calc(base.def, iv.def, ev.def) + 5) * natureMult(nature, DEF)),
      spa: Math.floor((calc(base.spa, iv.spa, ev.spa) + 5) * natureMult(nature, SPA)),
      spd: Math.floor((calc(base.spd, iv.spd, ev.spd) + 5) * natureMult(nature, SPD)),
      spe: Math.floor((calc(base.spe, iv.spe, ev.spe) + 5) * natureMult(nature, SPE))
    };
  }

  const api = { NATURES, natureMult, calcStats };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PKR = root.PKR || {}; root.PKR.stats = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
