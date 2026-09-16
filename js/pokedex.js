/* ============================================
   pokedex.js — 宝可梦图鉴信息界面：数据懒加载 + 搜索 + 详情
   ============================================ */
window.PKR = window.PKR || {};

PKR.Pokedex = (() => {
  const { $, $$, debounce } = PKR.utils;
  const CFG = PKR.config.POKEDEX;
  const STAT_KEYS = [['hp', 'HP'], ['atk', '物攻'], ['def', '物防'], ['spa', '特攻'], ['spd', '特防'], ['spe', '速度']];

  const state = { active: false, speciesId: null, shiny: 0, demoInd: null };
  const dataPromises = new Map();

  /* ---------- 数据懒加载（classic script 注入，file:// 兼容） ---------- */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => { s.remove(); reject(new Error('加载失败: ' + src)); };
      document.head.appendChild(s);
    });
  }

  function ensureDataFile(key) {
    if (dataPromises.has(key)) return dataPromises.get(key);
    const src = key.startsWith('learnset')
      ? CFG.DATA_FILES.learnset(Number(key.slice('learnset'.length)))
      : CFG.DATA_FILES[key];
    if (!src) return Promise.reject(new Error('未知数据文件: ' + key));
    const p = loadScript(src).catch(err => { dataPromises.delete(key); throw err; });
    dataPromises.set(key, p);
    return p;
  }

  function ensureCoreData() {
    if (PKR.data.species && PKR.data.moves) return Promise.resolve();
    return ensureDataFile('core').then(() => ensureDataFile('moves'));
  }

  function ensureLearnset(gen) {
    if (PKR.data.learnsets && PKR.data.learnsets[gen]) return Promise.resolve();
    return ensureDataFile('learnset' + gen);
  }

  /* ---------- 搜索 ---------- */
  function doSearch(input, resultsEl) {
    if (input.dataset.picked === '1') { delete input.dataset.picked; input.value = ''; resultsEl.hidden = true; return; }
    const q = input.value.trim().toLowerCase();
    if (!q || !PKR.data.species) { resultsEl.hidden = true; return; }
    const matches = [];
    if (/^\d+$/.test(q)) {
      const hit = PKR.data.species[String(Number(q))];
      if (hit) matches.push(hit);
    }
    if (!matches.length) {
      for (const rec of Object.values(PKR.data.species)) {
        if (rec.name.toLowerCase().includes(q) || rec.nameEn.toLowerCase().includes(q)) matches.push(rec);
      }
    }
    matches.sort((a, b) => a.id - b.id);
    renderResults(matches.slice(0, CFG.SEARCH_LIMIT));
  }

  function renderResults(matches) {
    const root = $('[data-screen="pokedex"]');
    const resultsEl = $('.pokedex-results', root);
    const input = $('#pokedex-search-input', root);
    resultsEl.textContent = '';
    if (!matches.length) {
      const li = document.createElement('li');
      li.className = 'pokedex-result pokedex-result--none';
      li.textContent = '没有找到匹配的宝可梦';
      resultsEl.appendChild(li);
    } else {
      for (const rec of matches) {
        const li = document.createElement('li');
        li.className = 'pokedex-result';
        li.appendChild(PKR.Sprite.render(rec.id, { cls: 'pokedex-result-sprite', alt: rec.name }));
        const no = document.createElement('span');
        no.className = 'pokedex-result-no';
        no.textContent = '#' + String(rec.id).padStart(4, '0');
        const name = document.createElement('span');
        name.className = 'pokedex-result-name';
        name.textContent = rec.name;
        const types = document.createElement('span');
        types.className = 'pokedex-result-types';
        for (const t of rec.types) {
          const dot = document.createElement('span');
          dot.className = 'pokedex-result-type type--' + t;
          dot.title = CFG.TYPE_ZH[t] || t;
          types.appendChild(dot);
        }
        li.append(no, name, types);
        li.addEventListener('click', () => {
          input.value = rec.name + '（#' + rec.id + '）';
          input.dataset.picked = '1'; // 标记为已选，下次聚焦直接清空重搜
          resultsEl.hidden = true;
          renderDetail(rec.id);
        });
        resultsEl.appendChild(li);
      }
    }
    resultsEl.hidden = false;
  }

  /* ---------- 详情渲染 ---------- */
  function updateCandyIcon(root, ratio) {
    $('.pd-candy-icon', root).style.setProperty('--fill', String(Math.min(1, Math.max(0, ratio))));
  }

  function renderDetail(speciesId) {
    const root = $('[data-screen="pokedex"]');
    const rec = PKR.data.species[String(speciesId)];
    if (!rec) return;
    state.speciesId = speciesId;
    state.shiny = 0;
    state.demoInd = null;

    $('.pokedex-empty', root).hidden = true;
    $('#pokedex-detail', root).hidden = false;

    /* 精灵图与闪光 tab */
    const spriteBox = $('#pd-sprite', root);
    spriteBox.textContent = '';
    spriteBox.appendChild(PKR.Sprite.render(speciesId, { cls: 'pd-sprite-img', alt: rec.name }));
    $$('.pd-shiny-tab', root).forEach(t => t.classList.toggle('active', t.dataset.shiny === '0'));
    $('.pd-shiny-badge', root).hidden = true;

    /* 头部：编号 / 名称 / 糖果 */
    $('.pd-no', root).textContent = '#' + String(speciesId).padStart(4, '0');
    $('.pd-name-text', root).textContent = rec.name;
    $('.pd-candy-count', root).textContent = '×' + PKR.PokedexStore.getCandy(speciesId);

    /* chips：属性 / 世代 / 费用 */
    const chips = $('.pd-chips', root);
    chips.textContent = '';
    for (const t of rec.types) {
      const chip = document.createElement('span');
      chip.className = 'pd-type-chip type--' + t;
      chip.textContent = CFG.TYPE_ZH[t] || t;
      chips.appendChild(chip);
    }
    const genChip = document.createElement('span');
    genChip.className = 'pd-chip';
    genChip.textContent = '第 ' + rec.gen + ' 世代';
    chips.appendChild(genChip);
    const costChip = document.createElement('span');
    costChip.className = 'pd-chip pd-cost-chip';
    costChip.title = '初始费用（用于组队预算）';
    const ball = document.createElement('span');
    ball.className = 'pokeball pokeball--mini';
    ball.setAttribute('aria-hidden', 'true');
    const costText = document.createElement('span');
    costText.textContent = '×' + rec.cost;
    costChip.append(ball, costText);
    chips.appendChild(costChip);

    /* 种族值 */
    $('.pd-bst', root).textContent = '合计 ' + rec.bst;
    const barsBox = $('.pd-stat-bars', root);
    barsBox.textContent = '';
    for (const [key, label] of STAT_KEYS) {
      const v = rec.stats[key];
      const row = document.createElement('div');
      row.className = 'pd-stat-row';
      const lab = document.createElement('span');
      lab.className = 'pd-stat-label';
      lab.textContent = label;
      const track = document.createElement('div');
      track.className = 'pd-stat-track';
      const fill = document.createElement('div');
      fill.className = 'pd-stat-fill';
      fill.style.width = (v / 255 * 100) + '%';
      fill.style.background = 'hsl(' + Math.round(v / 255 * 120) + ', 70%, 52%)'; // 低红 → 高绿
      track.appendChild(fill);
      const val = document.createElement('span');
      val.className = 'pd-stat-val';
      val.textContent = v;
      row.append(lab, track, val);
      barsBox.appendChild(row);
    }

    /* 示例个体（优先存档个体） */
    renderIndividual(root, rec, true);

    /* 蛋招式 */
    renderEggMoves(root, rec);

    /* 特性与被动 */
    const abList = $('.pd-abilities', root);
    abList.textContent = '';
    if (rec.abilities.length) {
      for (const ab of rec.abilities) {
        const li = document.createElement('li');
        li.textContent = ab;
        abList.appendChild(li);
      }
    } else {
      const li = document.createElement('li');
      li.className = 'pd-none';
      li.textContent = '暂无特性数据';
      abList.appendChild(li);
    }
    $('.pd-passive', root).textContent = rec.passive || '暂无被动（占位）';

    /* 技能池 */
    renderLearnset(root, rec);
  }

  /* ---------- 示例个体 ---------- */
  function renderIndividual(root, rec, preferSaved) {
    const saved = PKR.PokedexStore.getIndividuals(rec.id);
    const ind = (preferSaved && saved.length)
      ? saved[0]
      : PKR.individual.create({ speciesId: rec.id, level: 50, baseHappiness: rec.baseHappiness, rates: CFG.SHINY_RATES });
    state.demoInd = ind;

    const nat = PKR.stats.NATURES[ind.nature];
    const mod = (nat.up !== null ? ' +' + CFG.STAT_ZH[nat.up] : '') + (nat.down !== null ? ' -' + CFG.STAT_ZH[nat.down] : '');
    $('.pd-ind-nature-text', root).textContent = nat.zh + (mod || '（无修正）');
    $('.pd-ind-level', root).textContent = 'Lv.' + ind.level;
    $('.pd-ind-source', root).textContent = preferSaved && saved.length ? '（存档个体）' : '（示例个体，未入档）';

    /* IV chip */
    const ivRow = $('.pd-iv-row', root);
    ivRow.textContent = '';
    for (const [key, label] of STAT_KEYS) {
      const v = ind.iv[key];
      const chip = document.createElement('span');
      chip.className = 'pd-iv-chip' + (v === 31 ? ' iv-31' : v === 0 ? ' iv-0' : '');
      chip.textContent = label + ' ' + v;
      ivRow.appendChild(chip);
    }

    /* 实际属性表 */
    const actual = PKR.stats.calcStats({ base: rec.stats, iv: ind.iv, ev: ind.ev, level: ind.level, nature: ind.nature });
    const table = $('.pd-actual-stats', root);
    table.textContent = '';
    const head = document.createElement('div');
    head.className = 'pd-actual-head';
    ['', '种族值', '天赋值', '实际属性'].forEach(h => {
      const span = document.createElement('span');
      span.textContent = h;
      head.appendChild(span);
    });
    table.appendChild(head);
    for (const [key, label] of STAT_KEYS) {
      const row = document.createElement('div');
      row.className = 'pd-actual-row';
      [[label], [rec.stats[key]], [ind.iv[key]], [actual[key]]].forEach(([v]) => {
        const span = document.createElement('span');
        span.textContent = v;
        row.appendChild(span);
      });
      table.appendChild(row);
    }

    /* 好感度进度 */
    const fp = PKR.candy.friendshipProgress(ind.friendship, CFG.FRIENDSHIP_MAX);
    $('.pd-friend-fill', root).style.width = (fp.ratio * 100) + '%';
    $('.pd-friend-num', root).textContent = ind.friendship + '/' + CFG.FRIENDSHIP_MAX;

    /* 糖果图标随好感度填充 */
    updateCandyIcon(root, fp.ratio);
  }

  /* ---------- 蛋招式 ---------- */
  function renderEggMoves(root, rec) {
    const list = $('.pd-egg-moves', root);
    list.textContent = '';
    const unlocked = PKR.PokedexStore.getEggUnlocks(rec.id);
    const moves = rec.eggMoves || [];
    if (!moves.length) {
      const li = document.createElement('li');
      li.className = 'pd-egg-move egg-empty';
      li.textContent = '暂无蛋招式数据';
      list.appendChild(li);
      return;
    }
    moves.forEach((moveId, i) => {
      const mv = PKR.data.moves[String(moveId)];
      const li = document.createElement('li');
      li.className = 'pd-egg-move';
      if (i === rec.eggRareIdx) li.classList.add('egg-rare');
      if (!unlocked.includes(moveId)) li.classList.add('egg-locked');

      const chip = document.createElement('span');
      chip.className = 'pd-move-chip' + (mv ? ' type--' + mv.type : '');
      chip.textContent = mv ? mv.name : '#' + moveId;
      li.appendChild(chip);

      if (mv && mv.power != null) {
        const pw = document.createElement('span');
        pw.className = 'pd-move-power';
        pw.textContent = '威力 ' + mv.power;
        li.appendChild(pw);
      }
      if (i === rec.eggRareIdx) {
        const badge = document.createElement('span');
        badge.className = 'pd-egg-rare-badge';
        badge.textContent = '稀有';
        li.appendChild(badge);
      }
      if (!unlocked.includes(moveId)) {
        const lock = document.createElement('span');
        lock.className = 'pd-egg-lock';
        lock.textContent = '🔒 未解锁';
        lock.title = '孵化时有几率解锁，下局游戏可用';
        li.appendChild(lock);
      } else {
        const ok = document.createElement('span');
        ok.className = 'pd-egg-unlocked';
        ok.textContent = '✓ 已解锁';
        li.appendChild(ok);
      }
      list.appendChild(li);
    });
  }

  /* ---------- 技能池 ---------- */
  function renderLearnset(root, rec) {
    const body = $('.pd-learnset-body', root);
    const hint = document.createElement('p');
    hint.className = 'pd-learnset-hint';
    hint.textContent = '技能池加载中……';
    body.textContent = '';
    body.appendChild(hint);

    ensureLearnset(rec.gen).then(() => {
      if (state.speciesId !== rec.id) return; // 已切换物种
      buildLearnsetBody(root, rec, false);
    }).catch(err => {
      console.warn('[Pokedex] 技能池加载失败', err);
      if (state.speciesId === rec.id) {
        body.textContent = '';
        const p = document.createElement('p');
        p.className = 'pd-learnset-hint';
        p.textContent = '技能池加载失败，请检查网络后重试';
        body.appendChild(p);
      }
    });
  }

  function buildLearnsetBody(root, rec, allGens) {
    const body = $('.pd-learnset-body', root);
    body.textContent = '';
    const gens = allGens ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [rec.gen];
    let shown = 0;

    for (const gen of gens) {
      const data = PKR.data.learnsets && PKR.data.learnsets[gen];
      const entries = data && data[String(rec.id)];
      if (!entries || !entries.length) continue;

      const group = document.createElement('details');
      group.className = 'pd-learnset-gen';
      if (shown === 0) group.open = true;
      const summary = document.createElement('summary');
      summary.textContent = '第 ' + gen + ' 世代（' + entries.length + ' 个招式）';
      group.appendChild(summary);

      const wrap = document.createElement('div');
      wrap.className = 'pd-move-list';
      for (const { m, lv } of entries) {
        const mv = PKR.data.moves[String(m)];
        const chip = document.createElement('span');
        chip.className = 'pd-move-chip' + (mv ? ' type--' + mv.type : '');
        chip.textContent = (mv ? mv.name : '#' + m);
        if (lv === 0) {
          const tm = document.createElement('em');
          tm.className = 'pd-tm-tag';
          tm.textContent = 'TM';
          chip.appendChild(tm);
        } else {
          const lvTag = document.createElement('em');
          lvTag.className = 'pd-lv-tag';
          lvTag.textContent = 'Lv.' + lv;
          chip.appendChild(lvTag);
        }
        wrap.appendChild(chip);
      }
      group.appendChild(wrap);
      body.appendChild(group);
      shown++;
    }

    if (!shown) {
      const p = document.createElement('p');
      p.className = 'pd-learnset-hint';
      p.textContent = allGens ? '暂无技能池数据' : '本世代暂无技能池数据';
      body.appendChild(p);
      return;
    }

    if (!allGens) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pd-learnset-all';
      btn.textContent = '加载全部世代技能池';
      btn.addEventListener('click', () => {
        const toLoad = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(g => !(PKR.data.learnsets && PKR.data.learnsets[g]));
        btn.disabled = true;
        btn.textContent = '加载中……';
        Promise.all(toLoad.map(g => ensureLearnset(g))).then(() => {
          if (state.speciesId === rec.id) buildLearnsetBody(root, rec, true);
        }).catch(() => {
          btn.disabled = false;
          btn.textContent = '加载失败，点击重试';
        });
      });
      body.appendChild(btn);
    }
  }

  /* ---------- 屏幕生命周期 ---------- */
  function onEnter() {
    state.active = true;
    state.speciesId = null;
    const root = $('[data-screen="pokedex"]');
    $('#pokedex-detail', root).hidden = true;
    $('.pokedex-results', root).hidden = true;
    $('#pokedex-search-input', root).value = '';

    const ready = !!(PKR.data.species && PKR.data.moves);
    $('.pokedex-loading', root).hidden = ready;
    $('.pokedex-empty', root).hidden = !ready;
    if (ready) return;

    ensureCoreData().then(() => {
      if (!state.active) return;
      $('.pokedex-loading', root).hidden = true;
      $('.pokedex-empty', root).hidden = false;
    }).catch(err => {
      console.error('[Pokedex] 核心数据加载失败', err);
      if (state.active) {
        $('.pokedex-loading', root).hidden = true;
        PKR.toast.show('图鉴数据加载失败，请检查网络后重试');
      }
    });
  }

  function onExit() {
    state.active = false;
  }

  function init() {
    const root = $('[data-screen="pokedex"]');
    const input = $('#pokedex-search-input', root);
    const resultsEl = $('.pokedex-results', root);

    /* 搜索（防抖 200ms）。用户输入时先清掉"已选中"标记，避免防抖后误清空新输入 */
    const search = debounce(() => { if (state.active) doSearch(input, resultsEl); }, 200);
    input.addEventListener('input', () => { delete input.dataset.picked; search(); });
    input.addEventListener('focus', search);
    document.addEventListener('click', e => {
      if (!root.contains(e.target)) resultsEl.hidden = true;
    });

    /* 闪光形态切换 */
    $$('.pd-shiny-tab', root).forEach(tab => {
      tab.addEventListener('click', () => {
        if (state.speciesId === null) return;
        state.shiny = Number(tab.dataset.shiny);
        $$('.pd-shiny-tab', root).forEach(t => t.classList.toggle('active', t === tab));
        const img = $('.pd-sprite-img', root);
        const badge = $('.pd-shiny-badge', root);
        img.classList.remove('shiny-filter--yellow', 'shiny-filter--blue', 'shiny-filter--red');
        badge.hidden = true;
        badge.classList.remove('shiny-badge--yellow', 'shiny-badge--blue', 'shiny-badge--red');
        if (state.shiny === 1) { img.classList.add('shiny-filter--yellow'); badge.textContent = '★ 黄闪'; badge.classList.add('shiny-badge--yellow'); badge.hidden = false; }
        else if (state.shiny === 2) { img.classList.add('shiny-filter--blue'); badge.textContent = '★ 蓝闪'; badge.classList.add('shiny-badge--blue'); badge.hidden = false; }
        else if (state.shiny === 3) { img.classList.add('shiny-filter--red'); badge.textContent = '★ 红闪'; badge.classList.add('shiny-badge--red'); badge.hidden = false; }
      });
    });

    /* 换一只（重随机示例个体，不进档） */
    $('.pd-ind-reroll', root).addEventListener('click', () => {
      if (state.speciesId === null) return;
      const rec = PKR.data.species[String(state.speciesId)];
      if (rec) renderIndividual(root, rec, false);
    });

    /* 返回主菜单 */
    $('[data-action="back"]', root).addEventListener('click', () => PKR.ScreenManager.go('menu'));

    PKR.ScreenManager.register('pokedex', { el: root, onEnter, onExit });
  }

  return { init };
})();
