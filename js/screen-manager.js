/* ============================================
   screen-manager.js — 屏幕注册与切换（带过渡动画）
   ============================================ */
window.PKR = window.PKR || {};

PKR.ScreenManager = (() => {
  const screens = new Map();
  const TRANSITION_MS = 500; // 与 CSS 过渡时长对应，作为兜底
  let current = null;
  let switching = false;
  let pending = null; // 过渡期间的导航请求排队（只保留最新一次）

  function register(name, { el, onEnter, onExit }) {
    screens.set(name, { name, el, onEnter, onExit });
  }

  function go(name, params) {
    const target = screens.get(name);
    if (!target) return Promise.reject(new Error('[ScreenManager] 未注册的屏幕: ' + name));
    if (target === current) return Promise.resolve();
    if (switching) {
      // 过渡进行中：排队，当前过渡结束后自动执行，避免导航被静默丢弃
      pending = { name, params };
      return Promise.resolve();
    }

    switching = true;
    const prev = current;

    const safeCall = (fn, label) => {
      if (typeof fn !== 'function') return;
      try { fn(params); }
      catch (err) { console.error('[ScreenManager] ' + label + ' 异常：', err); }
    };
    safeCall(prev && prev.onExit, `onExit(${prev ? prev.name : ''})`);
    safeCall(target.onEnter, `onEnter(${name})`);

    target.el.classList.add('active');
    void target.el.offsetWidth; // 强制 reflow，确保过渡动画生效
    if (prev) prev.el.classList.remove('active');
    current = target;

    return PKR.utils.delay(TRANSITION_MS).then(() => {
      switching = false;
      if (pending) {
        const p = pending;
        pending = null;
        return go(p.name, p.params);
      }
    });
  }

  return {
    register,
    go,
    get current() { return current ? current.name : null; }
  };
})();
