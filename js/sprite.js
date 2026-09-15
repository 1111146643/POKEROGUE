/* ============================================
   sprite.js — 精灵图统一渲染 + 失败降级为剪影占位
   ============================================ */
window.PKR = window.PKR || {};

PKR.Sprite = (() => {
  function url(id) {
    return PKR.config.SPRITE_BASE + id + '.png';
  }

  function silhouette(id, { cls = '', alt = '宝可梦' } = {}) {
    const ph = document.createElement('span');
    ph.className = 'pkm-silhouette' + (cls ? ' ' + cls : '');
    ph.setAttribute('role', 'img');
    ph.setAttribute('aria-label', alt + '（加载失败，剪影占位）');
    if (!PKR.state.preload.failedIds.includes(id)) PKR.state.preload.failedIds.push(id);
    return ph;
  }

  function render(id, { cls = '', alt = '宝可梦' } = {}) {
    if (PKR.state.preload.failedIds.includes(id)) return silhouette(id, { cls, alt });
    const img = document.createElement('img');
    img.src = url(id);
    img.alt = alt;
    img.loading = 'lazy';
    if (cls) img.className = cls;
    /* 兜底：预加载成功后中途加载失败，就地替换为剪影 */
    img.addEventListener('error', () => {
      img.replaceWith(silhouette(id, { cls, alt }));
    }, { once: true });
    return img;
  }

  return { url, render };
})();
