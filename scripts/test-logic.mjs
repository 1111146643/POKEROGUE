#!/usr/bin/env node
/* ============================================
   test-logic.mjs — 逻辑模块冒烟测试（零依赖）
   用法: node scripts/test-logic.mjs
   ============================================ */
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const MOD = p => require(join(__dirname, '..', 'js', 'modules', p));

const stats = MOD('stats.js');
const candy = MOD('candy.js');
const eggMoves = MOD('egg-moves.js');
const individual = MOD('individual.js');

let passed = 0, failed = 0;
function check(label, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.error(`  ✗ ${label} ${detail}`); }
}
function approx(actual, expected, tol) { return Math.abs(actual - expected) <= expected * tol; }

console.log('== stats.js ==');
check('性格共 25 种', stats.NATURES.length === 25);
check('中位性格（下标 12）为认真', stats.NATURES[12].zh === '认真');
check('固执 = +物攻 -特攻', stats.NATURES[3].en === 'adamant' && stats.NATURES[3].up === 0 && stats.NATURES[3].down === 2);
check('固执物攻修正 ×1.1', stats.natureMult(3, 0) === 1.1);
check('固执特攻修正 ×0.9', stats.natureMult(3, 2) === 0.9);
check('固执 HP 不受影响', stats.natureMult(3, 99) === 1);
check('无修正性格返回 1', stats.natureMult(0, 0) === 1 && stats.natureMult(12, 4) === 1);

const pikaBase = { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 };
const iv31 = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
const s1 = stats.calcStats({ base: pikaBase, iv: iv31, level: 50 });
check('皮卡丘 Lv50 IV31 → HP 110', s1.hp === 110, `实际 ${s1.hp}`);
check('皮卡丘 Lv50 IV31 → 物攻 75（认真）', s1.atk === 75, `实际 ${s1.atk}`);
const s2 = stats.calcStats({ base: pikaBase, iv: iv31, level: 50, nature: 3 }); // 固执
check('固执物攻 = floor(75×1.1) = 82', s2.atk === 82, `实际 ${s2.atk}`);
check('固执特攻 = (floor(65.5)+5)×0.9 = 63', s2.spa === 63, `实际 ${s2.spa}`);
const s3 = stats.calcStats({ base: pikaBase, iv: iv31, level: 100, nature: 12 });
check('皮卡丘 Lv100 IV31 → HP 211', s3.hp === 211, `实际 ${s3.hp}`);

console.log('== candy.js ==');
const C = candy.defaults;
check('捕捉普通 = 1', candy.calcCandy({ method: 'catch' }) === 1);
check('孵化普通 = 2', candy.calcCandy({ method: 'hatch' }) === 2);
check('捕捉 Boss = 2', candy.calcCandy({ method: 'catch', isBoss: true }) === 2);
check('孵化 Boss = 4', candy.calcCandy({ method: 'hatch', isBoss: true }) === 4);
check('捕捉黄闪 = 5', candy.calcCandy({ method: 'catch', shiny: 1 }) === 5);
check('捕捉蓝闪 = 10', candy.calcCandy({ method: 'catch', shiny: 2 }) === 10);
check('捕捉红闪 = 20', candy.calcCandy({ method: 'catch', shiny: 3 }) === 20);
check('孵化 Boss 红闪 = 80', candy.calcCandy({ method: 'hatch', isBoss: true, shiny: 3 }) === 80);
check('自定义倍率生效', candy.calcCandy({ method: 'catch', shiny: 3, mult: { catchBase: 2, hatchBase: 2, bossMult: 2, shinyMult: [1, 5, 10, 20] } }) === 40);

const fp = candy.friendshipProgress(107, 255);
check('好感度 107/255 ratio 正确', approx(fp.ratio, 107 / 255, 1e-9) && fp.remain === 148 && !fp.full);
check('好感度满值 full=true', candy.friendshipProgress(255).full);
const cf = candy.consumeFriendship(300, 255);
check('好感度 300 → 1 糖果 + 45 剩余', cf.candy === 1 && cf.remainFriendship === 45);

console.log('== egg-moves.js ==');
const species = { eggMoves: [100, 101, 102, 103], eggRareIdx: 3 };
const rngSeq = (arr) => () => arr.length ? arr.shift() : 0;
check('无命中时返回空', eggMoves.rollUnlock({ species, rng: rngSeq([0.9, 0.9, 0.9, 0.9]) }).length === 0);
check('全命中时返回全部 4 个', eggMoves.rollUnlock({ species, rng: rngSeq([0, 0, 0, 0]) }).length === 4);
check('已解锁的不再重复', eggMoves.rollUnlock({ species, alreadyUnlocked: [100, 103], rng: rngSeq([0, 0, 0, 0]) }).join(',') === '101,102');
check('确定性：同 rng 序列结果一致',
  JSON.stringify(eggMoves.rollUnlock({ species, rng: rngSeq([0.1, 0.3, 0.9, 0.04]) })) ===
  JSON.stringify(eggMoves.rollUnlock({ species, rng: rngSeq([0.1, 0.3, 0.9, 0.04]) })));

// 蒙特卡洛：稀有招式在标准池命中率 ≈ 5%，eggUp 池 ≈ 15%
function rareHitRate(poolType, n = 20000) {
  let hit = 0;
  for (let i = 0; i < n; i++) {
    const got = eggMoves.rollUnlock({ species, poolType });
    if (got.includes(103)) hit++;
  }
  return hit / n;
}
const stdRate = rareHitRate('standard');
const eggUpRate = rareHitRate('eggUp');
check('标准池稀有命中率 ≈ 5%（±20%）', approx(stdRate, 0.05, 0.2), `实际 ${stdRate}`);
check('eggUp 池稀有命中率 ≈ 15%（±20%）', approx(eggUpRate, 0.15, 0.2), `实际 ${eggUpRate}`);
check('eggUp 显著高于标准池', eggUpRate > stdRate);

console.log('== individual.js ==');
check('闪光枚举正确', individual.SHINY.NONE === 0 && individual.SHINY.YELLOW === 1 && individual.SHINY.BLUE === 2 && individual.SHINY.RED === 3);

// 蒙特卡洛：10 万次闪光判定
function shinyDist(n = 100000) {
  const d = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) d[individual.rollShiny()]++;
  return d.map(x => x / n);
}
const dist = shinyDist();
check('黄闪 ≈ 1/256（±20%）', approx(dist[1], 1 / 256, 0.2), `实际 ${dist[1]}`);
check('蓝闪 ≈ 1/2048（±60%）', approx(dist[2], 1 / 2048, 0.6), `实际 ${dist[2]}`);
check('红闪 ≈ 1/8192（±60%）', approx(dist[3], 1 / 8192, 0.6), `实际 ${dist[3]}`);

const ind = individual.create({ speciesId: 25, level: 50, baseHappiness: 70 });
check('个体结构完整', !!ind.uid && ind.speciesId === 25 && ind.level === 50 && ind.nature >= 0 && ind.nature < 25 && ind.shiny >= 0 && ind.shiny <= 3);
check('六维 IV 均 0-31', Object.values(ind.iv).every(v => v >= 0 && v <= 31));
check('初始好感度 = 基准 70', ind.friendship === 70);
const ind2 = individual.create({ speciesId: 25, baseHappiness: 300 });
check('好感度 clamp 到 255', ind2.friendship === 255);

console.log(`\n结果：${passed} 通过，${failed} 失败`);
process.exit(failed ? 1 : 0);
