/* ============================================
   auth.js — 登录/注册屏：Tab 切换、表单校验、密码强度、昵称存取
   ============================================ */
window.PKR = window.PKR || {};

PKR.Auth = (() => {
  const { $, $$, debounce, restartAnimation, validateField, scorePassword } = PKR.utils;
  const EV = PKR.config.EVENTS;
  const STRENGTH_LABELS = ['', '弱', '中', '强', '极强'];

  function setTab(root, targetName) {
    $$('.auth-tab', root).forEach(tab => {
      const on = tab.dataset.tab === targetName;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', String(on));
    });
    $$('.auth-panel', root).forEach(panel => {
      const on = panel.dataset.form === targetName;
      panel.classList.toggle('active', on);
      if (on) restartAnimation(panel, 'swap');
    });
  }

  function clearErrors(root) {
    $$('.input.invalid', root).forEach(i => i.classList.remove('invalid'));
    $$('.field-error', root).forEach(e => { e.textContent = ''; e.hidden = true; });
  }

  function setFieldState(input, msg) {
    const field = input.closest('.form-field');
    const errEl = $('.field-error', field);
    if (msg) {
      input.classList.add('invalid');
      errEl.textContent = msg;
      errEl.hidden = false;
      restartAnimation(field, 'shake');
    } else {
      input.classList.remove('invalid');
      errEl.textContent = '';
      errEl.hidden = true;
    }
  }

  function validateInput(input, form) {
    const formData = { password: $('[name=password]', form).value };
    const result = validateField(input.name, input.value, formData);
    setFieldState(input, result.ok ? '' : result.msg);
    return result.ok;
  }

  function updateStrength(pw) {
    const root = $('[data-screen="auth"]');
    const segs = $$('.strength-seg', root);
    const label = $('.strength-label', root);
    const score = scorePassword(pw);
    segs.forEach((seg, i) => seg.classList.toggle('on', i < score));
    label.textContent = pw ? '强度：' + STRENGTH_LABELS[score] : '';
  }

  function onSubmit(form) {
    const isRegister = form.dataset.form === 'register';
    const nicknameInput = $('[name=nickname]', form);
    const passwordInput = $('[name=password]', form);
    const inputs = isRegister
      ? [nicknameInput, passwordInput, $('[name=confirm]', form)]
      : [nicknameInput, passwordInput];

    let firstInvalid = null;
    inputs.forEach(input => {
      if (!validateInput(input, form) && !firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) { firstInvalid.focus(); return; }

    /* 占位实现：仅存昵称到本地，后续可无缝替换为真实后端 */
    const nickname = nicknameInput.value.trim();
    PKR.storage.set('pkrogue.nickname', nickname);
    PKR.state.player.nickname = nickname;
    PKR.EventBus.emit(EV.AUTH_SUBMIT, { name: nickname, mode: isRegister ? 'register' : 'login' });
    PKR.toast.show(`欢迎来到宝可梦肉鸽，${nickname}！`);
    PKR.ScreenManager.go('menu');
  }

  function onEnter() {
    const root = $('[data-screen="auth"]');
    /* 每次进入重置为干净状态 */
    $$('input', root).forEach(i => { i.value = ''; });
    clearErrors(root);
    updateStrength('');
    setTab(root, 'login');
    /* 登录表单预填已保存的昵称 */
    const saved = PKR.storage.get('pkrogue.nickname');
    if (saved) $('#login-name', root).value = saved;
  }

  function init() {
    const root = $('[data-screen="auth"]');

    /* Tab 切换 */
    $$('.auth-tab', root).forEach(tab => {
      tab.addEventListener('click', () => {
        if (tab.classList.contains('active')) return;
        setTab(root, tab.dataset.tab);
        clearErrors(root);
        if (tab.dataset.tab === 'register') updateStrength($('#reg-pass', root).value);
        if (tab.dataset.tab === 'login') {
          const saved = PKR.storage.get('pkrogue.nickname');
          const nameInput = $('#login-name', root);
          if (saved && !nameInput.value) nameInput.value = saved;
        }
      });
    });

    /* 表单提交 + 实时校验 */
    $$('.auth-panel', root).forEach(form => {
      form.addEventListener('submit', e => {
        e.preventDefault();
        onSubmit(form);
      });
      $$('input', form).forEach(input => {
        const validate = () => validateInput(input, form);
        input.addEventListener('input', debounce(validate, 300));
        input.addEventListener('blur', validate);
      });
    });

    /* 密码强度 */
    $('#reg-pass', root).addEventListener('input', e => updateStrength(e.target.value));

    /* 装饰精灵（均为预加载列表内的 id，命中缓存） */
    $$('.sprite-deco[data-sprite]', root).forEach(holder => {
      holder.appendChild(PKR.Sprite.render(Number(holder.dataset.sprite), { cls: 'deco-img', alt: '宝可梦' }));
    });

    PKR.ScreenManager.register('auth', { el: root, onEnter });
  }

  return { init };
})();
