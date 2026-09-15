/* ============================================
   loading.js — 资源加载屏：真实预加载 + 进度 + 贴士/剪影轮换
   ============================================ */
window.PKR = window.PKR || {};

PKR.Loading = (() => {
  const { $, delay, clamp, restartAnimation } = PKR.utils;
  const EV = PKR.config.EVENTS;

  const timers = [];
  const tipIdx = { v: -1 };
  const silIdx = { v: -1 };
  let unsubProgress = null;

  /* ---------- 预加载核心 ---------- */
  function preloadImages(items, { onProgress, timeoutPerImage = 15000, minTime = 1500 } = {}) {
    const total = items.length;
    let done = 0;
    const failedIds = [];
    const startedAt = performance.now();

    return new Promise(resolve => {
      items.forEach(({ id }) => {
        const img = new Image();
        let finished = false;
        const watchdog = setTimeout(() => finish(false), timeoutPerImage); // 防挂起

        function finish(ok) {
          if (finished) return; // 超时与真实回调可能先后到达，防重复计数
          finished = true;
          clearTimeout(watchdog);
          done++;
          if (!ok) failedIds.push(id);
          if (onProgress) onProgress({ percent: (done / total) * 100, done, total, id, ok });
          if (done === total) {
            // 最短展示时间，避免资源秒载时进度条一闪而过
            const remain = Math.max(0, minTime - (performance.now() - startedAt));
            delay(remain).then(() => resolve({ failedIds }));
          }
        }

        img.onload = () => finish(true);
        img.onerror = () => finish(false); // 失败也必须推进度，否则离线时卡死
        img.src = PKR.Sprite.url(id);
      });
    });
  }

  /* ---------- 贴士 / 剪影轮换 ---------- */
  function showRandomTip(tipEl) {
    const tips = PKR.config.LOADING_TIPS;
    let i;
    do { i = Math.floor(Math.random() * tips.length); } while (i === tipIdx.v && tips.length > 1);
    tipIdx.v = i;
    tipEl.textContent = tips[i];
    restartAnimation(tipEl, 'swap');
  }

  function showRandomSilhouette(silEl, skelEl) {
    const items = PKR.config.PRELOAD_POKEMON_IDS;
    let i;
    do { i = Math.floor(Math.random() * items.length); } while (i === silIdx.v && items.length > 1);
    silIdx.v = i;
    const id = items[i].id;
    silEl.hidden = true;   // 新图加载完成前显示骨架占位
    skelEl.hidden = false;
    silEl.src = PKR.Sprite.url(id);
    restartAnimation(silEl, 'swap');
  }

  /* ---------- 屏幕生命周期 ---------- */
  function onEnter() {
    const root = $('[data-screen="loading"]');
    const tipEl = $('.loading-tip', root);
    const silEl = $('.loading-silhouette', root);
    const skelEl = $('.loading-skeleton', root);
    const percentEl = $('.loading-percent', root);
    const countEl = $('.loading-count', root);
    const fillEl = $('.ball-progress-fill', root);
    const ballEl = $('.ball-progress-ball', root);
    const barEl = $('.ball-progress', root);

    const total = PKR.config.PRELOAD_POKEMON_IDS.length;
    countEl.textContent = `0 / ${total} 张`;

    /* 剪影加载完成后揭示（失败则保持骨架占位） */
    silEl.addEventListener('load', () => {
      silEl.hidden = false;
      skelEl.hidden = true;
    });

    unsubProgress = PKR.EventBus.on(EV.LOADING_PROGRESS, ({ percent, done }) => {
      const pct = clamp(percent, 0, 100);
      percentEl.textContent = Math.round(pct) + '%';
      countEl.textContent = `${done} / ${total} 张`;
      fillEl.style.width = pct + '%';
      ballEl.style.left = clamp(pct, 1.5, 98.5) + '%';
      barEl.setAttribute('aria-valuenow', String(Math.round(pct)));
    });

    showRandomTip(tipEl);
    showRandomSilhouette(silEl, skelEl);
    timers.push(setInterval(() => showRandomTip(tipEl), 3000));
    timers.push(setInterval(() => showRandomSilhouette(silEl, skelEl), 3500));

    preloadImages(PKR.config.PRELOAD_POKEMON_IDS, {
      onProgress: p => PKR.EventBus.emit(EV.LOADING_PROGRESS, p)
    }).then(({ failedIds }) => {
      PKR.state.preload.failedIds = failedIds;
      if (failedIds.length) console.warn('[Loading] 部分图片加载失败，已降级为剪影占位：', failedIds);
      PKR.ScreenManager.go('auth');
    });
  }

  function onExit() {
    timers.splice(0).forEach(clearInterval);
    if (unsubProgress) { unsubProgress(); unsubProgress = null; }
  }

  function init() {
    PKR.ScreenManager.register('loading', {
      el: $('[data-screen="loading"]'),
      onEnter,
      onExit
    });
  }

  return { init, preloadImages };
})();
