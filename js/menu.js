/* ============================================
   menu.js — 游戏初始界面（主菜单）
   ============================================ */
window.PKR = window.PKR || {};

PKR.Menu = (() => {
  const { $, $$ } = PKR.utils;

  function onClick(item) {
    switch (item.id) {
      case 'new-game': PKR.toast.show('新的冒险正在开发中，敬请期待！'); break;
      case 'pokedex': PKR.ScreenManager.go('pokedex'); break;
      case 'settings': PKR.toast.show('设置功能正在开发中，敬请期待！'); break;
      default: break;
    }
  }

  function onEnter() {
    const root = $('[data-screen="menu"]');
    const nickname = PKR.state.player.nickname;
    $('.menu-greet-word', root).textContent = nickname ? '欢迎回来，' : '你好，';
    $('.menu-nickname', root).textContent = nickname || '新训练家';
  }

  function init() {
    const root = $('[data-screen="menu"]');
    const cardsEl = $('.menu-cards', root);

    /* 数据驱动渲染菜单卡片 */
    PKR.config.MENU_ITEMS.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card menu-card';
      if (item.disabled) { btn.classList.add('menu-card--disabled'); btn.disabled = true; }
      if (item.soon) btn.classList.add('menu-card--soon');
      if (item.accent) btn.style.setProperty('--accent', item.accent);

      const iconWrap = document.createElement('span');
      iconWrap.className = 'menu-card-icon';
      iconWrap.appendChild(PKR.Sprite.render(item.sprite, { cls: 'menu-card-sprite', alt: item.title }));

      const title = document.createElement('span');
      title.className = 'menu-card-title';
      title.textContent = item.title;

      const desc = document.createElement('span');
      desc.className = 'menu-card-desc';
      desc.textContent = item.desc;

      btn.append(iconWrap, title, desc);

      if (item.soon) {
        const badge = document.createElement('span');
        badge.className = 'menu-card-badge';
        badge.textContent = '敬请期待';
        btn.appendChild(badge);
      }

      btn.addEventListener('click', () => onClick(item));
      cardsEl.appendChild(btn);
    });

    /* 装饰精灵 */
    $$('.sprite-deco[data-sprite]', root).forEach(holder => {
      holder.appendChild(PKR.Sprite.render(Number(holder.dataset.sprite), { cls: 'deco-img', alt: '宝可梦' }));
    });

    PKR.ScreenManager.register('menu', { el: root, onEnter });
  }

  return { init };
})();
