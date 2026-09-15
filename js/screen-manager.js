/* ============================================
   screen-manager.js — 屏幕注册与切换（带过渡动画）
   ============================================ */
window.PKR = window.PKR || {};

PKR.ScreenManager = (() => {
  const screens = new Map();
  const TRANSITION_MS = 500; // 与 CSS 过渡时长对应，作为兜底
  let current = null;
  let switching = false;

  function register(name, { el, onEnter, onExit }) {
    screens.set(name, { name, el, onEnter, onExit });
  }

  function go(name, params) {
    const target = screens.get(name);
    if (!target) return Promise.reject(new Error('[ScreenManager] 未注册的屏幕: ' + name));
    if (switching || target === current) return Promise.resolve();

    switching = true;
    const prev = current;

    if (prev && typeof prev.onExit === 'function') prev.onExit(params);
    if (typeof target.onEnter === 'function') target.onEnter(params);

    target.el.classList.add('active');
    void target.el.offsetWidth; // 强制 reflow，确保过渡动画生效
    if (prev) prev.el.classList.remove('active');
    current = target;

    return PKR.utils.delay(TRANSITION_MS).then(() => { switching = false; });
  }

  return {
    register,
    go,
    get current() { return current ? current.name : null; }
  };
})();
