/* ============================================
   utils.js — 工具函数、EventBus、安全 storage、toast、表单校验
   ============================================ */
window.PKR = window.PKR || {};

/* ---------- 工具函数 ---------- */
PKR.utils = {
  $(sel, root = document) { return root.querySelector(sel); },
  $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); },
  delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); },
  clamp(v, min, max) { return Math.min(max, Math.max(min, v)); },
  debounce(fn, ms) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  },
  /* 重新触发 CSS 动画：先移除类，强制 reflow 后再加回 */
  restartAnimation(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }
};

/* ---------- EventBus（轻量发布订阅，为后续玩法留扩展点） ---------- */
PKR.EventBus = {
  _map: new Map(),
  on(event, cb) {
    if (!this._map.has(event)) this._map.set(event, new Set());
    this._map.get(event).add(cb);
    return () => this.off(event, cb);
  },
  off(event, cb) {
    const set = this._map.get(event);
    if (set) set.delete(cb);
  },
  emit(event, payload) {
    const set = this._map.get(event);
    if (!set) return;
    set.forEach(cb => {
      try { cb(payload); } catch (err) { console.error('[EventBus]', event, err); }
    });
  }
};

/* ---------- 安全 storage（file:// 下部分浏览器会抛 SecurityError，回退内存） ---------- */
PKR.storage = {
  _mem: new Map(),
  get(key) {
    try { return window.localStorage.getItem(key); }
    catch { return this._mem.has(key) ? this._mem.get(key) : null; }
  },
  set(key, value) {
    try { window.localStorage.setItem(key, String(value)); }
    catch { this._mem.set(key, String(value)); }
  },
  remove(key) {
    try { window.localStorage.removeItem(key); }
    catch { this._mem.delete(key); }
  }
};

/* ---------- Toast 提示 ---------- */
PKR.toast = {
  show(message, { duration = 2600 } = {}) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast';
    const ball = document.createElement('span');
    ball.className = 'pokeball pokeball--mini';
    ball.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = message;
    el.append(ball, text);
    root.appendChild(el);
    setTimeout(() => {
      el.classList.add('toast--leaving');
      // 兜底移除（reduced-motion 下 animationend 可能不触发）
      setTimeout(() => el.remove(), 400);
    }, duration);
  }
};

/* ---------- 表单字段校验（返回 { ok, msg }） ---------- */
PKR.utils.validateField = function (name, value, formData = {}) {
  if (name === 'nickname') {
    const v = String(value ?? '').trim();
    if (!v) return { ok: false, msg: '请输入训练家名称' };
    if (!/^[一-龥A-Za-z0-9_]{2,12}$/.test(v))
      return { ok: false, msg: '用户名需为 2-12 个字符，仅限中文、英文、数字和下划线' };
    return { ok: true };
  }
  if (name === 'password') {
    const v = String(value ?? '');
    if (!v) return { ok: false, msg: '请输入密码' };
    if (v.length < 8) return { ok: false, msg: '密码至少需要 8 位' };
    if (v.length > 20) return { ok: false, msg: '密码最多 20 位' };
    if (!/[A-Za-z]/.test(v) || !/[0-9]/.test(v))
      return { ok: false, msg: '密码需同时包含字母和数字' };
    return { ok: true };
  }
  if (name === 'confirm') {
    const v = String(value ?? '');
    if (!v) return { ok: false, msg: '请再次输入密码' };
    if (v !== formData.password) return { ok: false, msg: '两次输入的密码不一致' };
    return { ok: true };
  }
  return { ok: true };
};

/* ---------- 密码强度评分 0-4 ---------- */
PKR.utils.scorePassword = function (pw) {
  const v = String(pw ?? '');
  if (!v) return 0;
  let score = v.length >= 10 ? 2 : v.length >= 8 ? 1 : 0;
  if (/[a-z]/.test(v)) score++;
  if (/[A-Z]/.test(v)) score++;
  if (/[0-9]/.test(v)) score++;
  if (/[^A-Za-z0-9]/.test(v)) score++;
  if (/(.)\1\1/.test(v) || /(abc|123|012|456|789|qwe)/i.test(v)) score--;
  return PKR.utils.clamp(score, 0, 4);
};
