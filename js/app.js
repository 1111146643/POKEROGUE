/* ============================================
   app.js — 入口：初始化状态，注册所有屏幕，启动加载流程
   ============================================ */
window.PKR = window.PKR || {};

(() => {
  'use strict';

  /* 全局状态（普通对象直读直写，保持轻量） */
  PKR.state = {
    player: { nickname: PKR.storage.get('pkrogue.nickname') },
    preload: { failedIds: [] },
    theme: 'dark'
  };
  document.body.dataset.theme = PKR.state.theme;

  PKR.Loading.init();
  PKR.Auth.init();
  PKR.Menu.init();
  PKR.Pokedex.init();

  PKR.ScreenManager.go('loading');
})();
