#!/usr/bin/env node
/* ============================================
   build-data.mjs — 从 PokéAPI 生成本地数据文件 data/*.js
   用法:
     node scripts/build-data.mjs [--limit N] [--force] [--rate N] [--no-learnset] [--out DIR]
   - --limit N       只处理图鉴编号 1..N（默认 1025，开发测试用）
   - --force         忽略缓存强制重新拉取
   - --rate N        每分钟请求上限（默认 100，PokéAPI 公平使用限额）
   - --no-learnset   跳过技能池/招式/特性拉取，快速出核心数据
   - --out DIR       输出目录（默认 data/）
   响应缓存于 scripts/.cache/（原子写入，支持断点续跑）
   ============================================ */
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const API = 'https://pokeapi.co/api/v2';

/* ---------- CLI 参数 ---------- */
const args = process.argv.slice(2);
function argVal(flag, fallback) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
}
const opts = {
  limit: Number(argVal('--limit', 1025)),
  force: args.includes('--force'),
  rate: Number(argVal('--rate', 100)),
  noLearnset: args.includes('--no-learnset'),
  outDir: resolve(ROOT, argVal('--out', 'data'))
};

const log = (...a) => console.log('[build]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- 限速 + 缓存 + 重试 ---------- */
const CACHE_DIR = join(__dirname, '.cache');
const MIN_INTERVAL = 60000 / opts.rate;
let lastRequestAt = 0;

async function fetchJson(url, label, retries = 3) {
  const wait = Math.max(0, MIN_INTERVAL - (Date.now() - lastRequestAt));
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'POKEROGUE-build/0.1' } });
    if (res.status === 429) {
      const ra = res.headers.get('retry-after');
      const backoff = ra ? Number(ra) * 1000 : 2000;
      log(`429 限流（${label}），等待 ${Math.round(backoff / 1000)}s 后重试`);
      await sleep(backoff);
      if (retries > 0) return fetchJson(url, label, retries - 1);
      throw new Error('429 重试耗尽: ' + url);
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return await res.json();
  } catch (err) {
    if (retries > 0) {
      log(`请求失败（${label}）：${err.message}，1.5s 后重试（剩余 ${retries} 次）`);
      await sleep(1500);
      return fetchJson(url, label, retries - 1);
    }
    throw err;
  }
}

function cachePath(kind, key) { return join(CACHE_DIR, kind, String(key) + '.json'); }
function cacheGet(kind, key) {
  if (opts.force) return null;
  const p = cachePath(kind, key);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}
function cachePut(kind, key, data) {
  const p = cachePath(kind, key);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p + '.tmp', JSON.stringify(data)); // 原子写，防中断损坏
  renameSync(p + '.tmp', p);
}
async function fetchCached(kind, key) {
  const hit = cacheGet(kind, key);
  if (hit) return hit;
  const data = await fetchJson(`${API}/${kind}/${key}`, `${kind}/${key}`);
  cachePut(kind, key, data);
  return data;
}

/* ---------- 各世代主流版本组（技能池提取依据） ---------- */
const GEN_VERSION_GROUPS = {
  1: 'yellow',               // 覆盖皮卡丘家族专属
  2: 'crystal',
  3: 'firered-leafgreen',
  4: 'heartgold-soulsilver',
  5: 'black-2-white-2',
  6: 'omega-ruby-alpha-sapphire',
  7: 'ultra-sun-ultra-moon',
  8: 'sword-shield',         // 弃 LA（技能池特殊）与 BDSP（复刻）
  9: 'scarlet-violet'
};

/* ---------- 工具 ---------- */
function zhName(names, fallback) {
  const byLang = {};
  for (const n of names || []) byLang[String(n.language.name).toLowerCase()] = n.name; // PokéAPI 语言键为小写（zh-hans）
  return byLang['zh-hans'] || byLang['zh-hant'] || fallback || '';
}

/* PokéAPI 世代名为罗马数字（generation-i … generation-ix） */
const GEN_ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
function genNumFromName(name) { return GEN_ROMAN[String(name || '').replace('generation-', '').toLowerCase()] || 0; }
function idFromUrl(url) { return Number((url || '').match(/\/(\d+)\/?$/)?.[1]); }

/* 确定性 PRNG（mulberry32），保证同种子重建结果恒定 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- 游戏专属字段生成规则（可被 overrides 覆盖） ---------- */
function costFromBst(bst) {
  return Math.min(10, Math.max(1, 1 + Math.floor((bst - 200) / 55)));
}

function pickEggMoves(moveIds, moveMeta) {
  const speciesId = moveIds.__speciesId || 0; // 由调用方注入
  const rng = mulberry32(speciesId * 7919 + 1); // 固定盐，确定性
  const powerOf = id => moveMeta[id]?.power ?? 0;
  const normalPool = moveIds.filter(id => powerOf(id) <= 80).sort((a, b) => a - b); // 含变化招式（power null → 0）
  const rarePool = moveIds.filter(id => powerOf(id) > 80).sort((a, b) => a - b);

  const take = (pool, n) => {
    const arr = [...pool];
    const out = [];
    while (out.length < n && arr.length) out.push(arr.splice(Math.floor(rng() * arr.length), 1)[0]);
    return out;
  };

  let commons = take(normalPool, 3);
  let rareMove;
  if (commons.length < 3) {
    // 普通池不足 3 → 从稀有池补，稀有招式从剩余里再抽
    const remain = rarePool.filter(id => !commons.includes(id));
    commons = commons.concat(take(remain, 3 - commons.length));
    rareMove = take(rarePool.filter(id => !commons.includes(id)), 1)[0];
  } else {
    rareMove = take(rarePool, 1)[0];
  }
  if (rareMove === undefined && commons.length) {
    // 稀有池为空 → 取普通池中 power 最高者充稀有
    rareMove = commons.reduce((a, b) => (powerOf(a) >= powerOf(b) ? a : b));
  }

  let result = commons.concat(rareMove !== undefined ? [rareMove] : []);
  // 兜底：招式总数不足 4 → 优先补未用过的，仍不足则按 power 降序重复填充
  if (result.length < 4 && moveIds.length) {
    const sorted = [...moveIds].sort((a, b) => powerOf(b) - powerOf(a) || a - b);
    for (const id of sorted) { if (result.length >= 4) break; if (!result.includes(id)) result.push(id); }
    let j = 0;
    while (result.length < 4 && sorted.length) result.push(sorted[j++ % sorted.length]);
  }
  return result.slice(0, 4);
}

const PASSIVE_TEMPLATES = {
  normal: '坚韧身躯：受到伤害 -5%（占位）',
  fire: '烈焰之心：火属性招式威力 +10%（占位）',
  water: '潮汐之力：水属性招式威力 +10%（占位）',
  electric: '雷霆之魂：电属性招式威力 +10%（占位）',
  grass: '茂盛生机：草属性招式威力 +10%（占位）',
  ice: '寒冰护体：受到火属性伤害 -10%（占位）',
  fighting: '格斗本能：格斗属性招式威力 +10%（占位）',
  poison: '毒素累积：中毒伤害 +20%（占位）',
  ground: '大地庇佑：地面属性招式威力 +10%（占位）',
  flying: '疾风之翼：速度 +10%（占位）',
  psychic: '念力增幅：超能力属性招式威力 +10%（占位）',
  bug: '虫群意志：虫属性招式威力 +10%（占位）',
  rock: '岩石铠甲：受到物理伤害 -5%（占位）',
  ghost: '幽影诡计：幽灵属性招式威力 +10%（占位）',
  dragon: '龙之威严：龙属性招式威力 +10%（占位）',
  dark: '暗夜突袭：先手时伤害 +10%（占位）',
  steel: '钢铁壁垒：受到伤害 -5%（占位）',
  fairy: '妖精祝福：妖精属性招式威力 +10%（占位）'
};
const LEGENDARY_PASSIVE = '传说气场：全招式威力 +5%（占位）';

function passiveFor(types, isLegendary, isMythical) {
  const tpl = PASSIVE_TEMPLATES[types[0]] || PASSIVE_TEMPLATES.normal;
  return (isLegendary || isMythical) ? LEGENDARY_PASSIVE + ' ' + tpl : tpl;
}

/* ---------- 技能池提取 ---------- */
function extractLearnset(poke) {
  const learnsets = {}; // gen -> Map(moveUrl -> lv)（lv=0 机学，lv>0 等级习得）
  for (const [genStr, vg] of Object.entries(GEN_VERSION_GROUPS)) {
    const map = new Map();
    for (const mv of poke.moves || []) {
      for (const d of mv.version_group_details || []) {
        if (d.version_group.name !== vg) continue;
        if (d.move_learn_method.name === 'level-up' && d.level_learned_at >= 1) {
          const prev = map.get(mv.move.url);
          // 同世代同招式 level-up 与 machine 并存时保留 level-up；多次 level-up 取最低等级
          if (prev === undefined || prev === 0 || (prev > 0 && d.level_learned_at < prev)) {
            map.set(mv.move.url, d.level_learned_at);
          }
        } else if (d.move_learn_method.name === 'machine') {
          if (!map.has(mv.move.url)) map.set(mv.move.url, 0);
        }
      }
    }
    if (map.size) learnsets[Number(genStr)] = map;
  }
  return learnsets;
}

/* ---------- Overrides ---------- */
function loadOverrides() {
  const p = join(__dirname, 'data-overrides.json');
  if (!existsSync(p)) return { species: {}, moves: {} };
  try { return JSON.parse(readFileSync(p, 'utf8')); }
  catch (err) { console.warn('[build] data-overrides.json 解析失败，已忽略：', err.message); return { species: {}, moves: {} }; }
}

/* ---------- 输出 ---------- */
const FILE_HEADER = '/* POKEROGUE 数据文件 — 由 scripts/build-data.mjs 自动生成，请勿手改（覆盖用 scripts/data-overrides.json） */\n';
function writeDataFile(filename, body) {
  const p = join(opts.outDir, filename);
  const content = FILE_HEADER + 'window.PKR = window.PKR || {};\nPKR.data = PKR.data || {};\n' + body + '\n';
  writeFileSync(p, content);
  const kb = (statSync(p).size / 1024).toFixed(1);
  log(`已生成 ${filename}（${kb} KB）`);
}

/* ---------- 主流程 ---------- */
async function main() {
  log(`开始构建：limit=${opts.limit} rate=${opts.rate}/min learnset=${!opts.noLearnset} out=${opts.outDir}`);
  mkdirSync(opts.outDir, { recursive: true });
  const overrides = loadOverrides();
  const t0 = Date.now();

  /* 1. 拉取全部物种（pokemon + pokemon-species 各一次） */
  const species = new Map();   // id -> 原始记录
  const allMoveIds = new Set();
  const allAbilityIds = new Set();
  const rawLearnsets = new Map(); // id -> { gen: Map(moveUrl -> lv) }

  for (let id = 1; id <= opts.limit; id++) {
    const poke = await fetchCached('pokemon', id);
    const sp = await fetchCached('pokemon-species', id);
    species.set(id, { poke, sp });
    if (!opts.noLearnset) {
      rawLearnsets.set(id, extractLearnset(poke));
      for (const mv of poke.moves || []) allMoveIds.add(idFromUrl(mv.move.url));
    }
    for (const ab of poke.abilities || []) allAbilityIds.add(idFromUrl(ab.ability.url));
    if (id % 50 === 0) log(`物种拉取进度 ${id}/${opts.limit}`);
  }
  log(`物种拉取完成（${species.size} 只）`);

  /* 2. 招式与特性元数据 */
  const moveMeta = new Map();
  const abilityMeta = new Map();
  if (!opts.noLearnset) {
    const moveIds = [...allMoveIds].sort((a, b) => a - b);
    for (let i = 0; i < moveIds.length; i++) {
      const mid = moveIds[i];
      try {
        const mv = await fetchCached('move', mid);
        moveMeta.set(mid, mv);
      } catch (err) {
        console.warn(`[build] 招式 ${mid} 拉取失败，已跳过：${err.message}`);
      }
      if ((i + 1) % 100 === 0) log(`招式拉取进度 ${i + 1}/${moveIds.length}`);
    }
    log(`招式拉取完成（${moveMeta.size}/${moveIds.length}）`);
  }
  const abilityIds = [...allAbilityIds].sort((a, b) => a - b);
  for (const aid of abilityIds) {
    try {
      const ab = await fetchCached('ability', aid);
      abilityMeta.set(aid, ab);
    } catch (err) {
      console.warn(`[build] 特性 ${aid} 拉取失败，已跳过：${err.message}`);
    }
  }
  log(`特性拉取完成（${abilityMeta.size}/${abilityIds.length}）`);

  /* 3. 招式名 → id 查表（overrides 中文名转换用） */
  const moveNameToId = new Map();
  for (const [mid, mv] of moveMeta) {
    moveNameToId.set(mv.name, mid);
    moveNameToId.set(zhName(mv.names, mv.name), mid);
  }

  /* 4. 转换物种记录 + 应用覆盖 + 生成游戏字段 */
  const speciesOut = {};
  const learnsetsOut = {}; // gen -> { speciesId: [{m, lv}] }
  for (const [id, { poke, sp }] of species) {
    const ov = overrides.species?.[String(id)] || {};
    const types = (poke.types || []).slice().sort((a, b) => a.slot - b.slot).map(t => t.type.name);
    const statMap = {};
    for (const s of poke.stats || []) statMap[s.stat.name] = s.base_stat;
    const stats = { hp: statMap.hp || 0, atk: statMap.attack || 0, def: statMap.defense || 0, spa: statMap['special-attack'] || 0, spd: statMap['special-defense'] || 0, spe: statMap.speed || 0 };
    const bst = stats.hp + stats.atk + stats.def + stats.spa + stats.spd + stats.spe;

    const abilities = (poke.abilities || [])
      .slice().sort((a, b) => a.slot - b.slot)
      .map(a => abilityMeta.get(idFromUrl(a.ability.url)))
      .filter(Boolean)
      .map(ab => zhName(ab.names, ab.name))
      .slice(0, 3);

    const genNum = genNumFromName(sp.generation?.name);
    const isLegendary = !!sp.is_legendary;
    const isMythical = !!sp.is_mythical;

    /* 蛋招式：优先 overrides，否则规则生成 */
    let eggMoves = null;
    if (ov.eggMoves) {
      eggMoves = ov.eggMoves.map(m => {
        if (typeof m === 'number') return m;
        const found = moveNameToId.get(m);
        if (found === undefined) console.warn(`[build] overrides 招式名未找到：${m}（物种 #${id}）`);
        return found;
      }).filter(m => m !== undefined);
    } else if (!opts.noLearnset) {
      const union = new Set();
      const gens = rawLearnsets.get(id) || {};
      for (const map of Object.values(gens)) for (const url of map.keys()) union.add(idFromUrl(url));
      const moveIds = [...union].filter(mid => moveMeta.has(mid));
      moveIds.__speciesId = id;
      eggMoves = pickEggMoves(moveIds, Object.fromEntries(moveMeta));
    }
    eggMoves = (eggMoves || []).slice(0, 4);
    const eggRareIdx = eggMoves.length ? eggMoves.length - 1 : -1; // 第 4 个（最后一位）为稀有

    const record = {
      id,
      name: ov.name || zhName(sp.names, sp.name),
      nameEn: sp.name,
      types,
      gen: genNum,
      bst,
      stats,
      cost: ov.cost ?? costFromBst(bst),
      abilities,
      passive: ov.passive || passiveFor(types, isLegendary, isMythical),
      eggMoves,
      eggRareIdx,
      height: sp.height ? sp.height / 10 : null,   // dm → m
      weight: sp.weight ? sp.weight / 10 : null,   // hg → kg
      eggGroups: (sp.egg_groups || []).map(g => g.name),
      genderRate: sp.gender_rate ?? -1,
      captureRate: sp.capture_rate ?? null,
      baseHappiness: Math.min(255, Math.max(0, sp.base_happiness ?? 50)),
      growthRate: sp.growth_rate?.name || null,
      isLegendary,
      isMythical
    };
    speciesOut[String(id)] = record;

    /* 技能池：按世代输出（url → 招式 id，过滤掉元数据缺失的） */
    if (!opts.noLearnset) {
      for (const [gen, map] of Object.entries(rawLearnsets.get(id) || {})) {
        const entries = [];
        for (const [url, lv] of map) {
          const mid = idFromUrl(url);
          if (!moveMeta.has(mid)) continue;
          entries.push({ m: mid, lv });
        }
        if (!entries.length) continue;
        entries.sort((a, b) => a.lv - b.lv || a.m - b.m);
        learnsetsOut[gen] = learnsetsOut[gen] || {};
        learnsetsOut[gen][String(id)] = entries;
      }
    }
  }
  log(`物种转换完成（${Object.keys(speciesOut).length} 只）`);

  /* 5. 招式元数据输出 */
  const movesOut = {};
  for (const [mid, mv] of moveMeta) {
    movesOut[String(mid)] = {
      id: mid,
      name: zhName(mv.names, mv.name),
      nameEn: mv.name,
      type: mv.type?.name || 'normal',
      power: mv.power,
      pp: mv.pp,
      accuracy: mv.accuracy,
      dmgClass: mv.damage_class?.name || 'status'
    };
  }

  /* 6. 写文件 */
  writeDataFile('pokemon-data.js', 'PKR.data.species = ' + JSON.stringify(speciesOut) + ';');
  writeDataFile('moves-data.js', 'PKR.data.moves = ' + JSON.stringify(movesOut) + ';');
  if (!opts.noLearnset) {
    for (const [gen, data] of Object.entries(learnsetsOut)) {
      writeDataFile(
        `learnsets-gen${gen}.js`,
        `PKR.data.learnsets = PKR.data.learnsets || {};\nPKR.data.learnsets[${gen}] = ` + JSON.stringify(data) + ';'
      );
    }
    log(`技能池世代文件：${Object.keys(learnsetsOut).join(', ')}`);
  }

  const elapsed = ((Date.now() - t0) / 60000).toFixed(1);
  log(`构建完成，耗时 ${elapsed} 分钟。物种 ${Object.keys(speciesOut).length} / 招式 ${Object.keys(movesOut).length} / 特性 ${abilityMeta.size}`);
}

main().catch(err => {
  console.error('[build] 构建失败：', err);
  process.exit(1);
});
