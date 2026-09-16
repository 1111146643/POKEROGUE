/* ============================================
   config.js — 全局数据常量
   ============================================ */
window.PKR = window.PKR || {};

PKR.config = {
  /* 预加载的宝可梦：御三家、皮卡丘、伊布家族、卡比兽、三神鸟、超梦/梦幻 */
  PRELOAD_POKEMON_IDS: [1, 2, 3, 4, 5, 6, 7, 8, 9, 25, 133, 134, 135, 136, 196, 197, 470, 471, 700, 143, 144, 145, 146, 150, 151].map(id => ({ id })),

  /* 精灵图 CDN 基础地址（PokéAPI 官方 sprite，支持 CORS） */
  SPRITE_BASE: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/',

  /* 加载页轮换贴士 */
  LOADING_TIPS: [
    '属性克制是战斗胜利的关键！',
    '草、火、水三种属性互相克制。',
    '传说宝可梦需要特定的时机才会出现。',
    '保存你的冒险进度，随时继续挑战。',
    '闪光宝可梦极其稀有，遇到它可别错过！',
    '在肉鸽冒险中，每一次选择都影响后续的旅程。',
    '皮卡丘其实最初是作为第二世代宝可梦设计的。',
    '伊布拥有最多的进化形态，一共八种！',
    '超梦是由科学家通过基因改造创造出来的。',
    '三神鸟分别守护着雷电、火焰与冰冻的力量。',
    '卡比兽一天要吃掉 400 公斤的食物。',
    '喵喵头上的金币其实是它最喜欢的东西。',
    '梦幻是所有宝可梦的共同祖先。',
    '大岩蛇的身体由坚硬的岩石构成，普通攻击难以奏效。',
    '训练家与宝可梦的羁绊，比任何招式都强大。'
  ],

  /* 事件名常量 */
  EVENTS: {
    LOADING_PROGRESS: 'loading:progress',
    AUTH_SUBMIT: 'auth:submit'
  },

  /* 主菜单卡片（数据驱动渲染） */
  MENU_ITEMS: [
    { id: 'new-game', title: '新的冒险', desc: '开启全新的肉鸽之旅', sprite: 4, accent: 'var(--type-fire)' },
    { id: 'continue', title: '继续冒险', desc: '暂无存档', sprite: 143, accent: 'var(--type-normal)', disabled: true },
    { id: 'pokedex', title: '宝可梦图鉴', desc: '收集并查看宝可梦', sprite: 151, accent: 'var(--type-psychic)' },
    { id: 'settings', title: '设置', desc: '声音与显示选项', sprite: 25, accent: 'var(--type-electric)', soon: true }
  ],

  /* ---------- 宝可梦个体系统（二期） ---------- */
  POKEDEX: {
    SEARCH_LIMIT: 20,
    /* 闪光基础概率（待平衡调整）：黄闪 < 蓝闪 < 红闪 */
    SHINY_RATES: { yellow: 1 / 256, blue: 1 / 2048, red: 1 / 8192 },
    /* 糖果规则：捕捉+1、孵化+2、Boss×2、黄闪×5、蓝闪×10、红闪×20 */
    CANDY: { catchBase: 1, hatchBase: 2, bossMult: 2, shinyMult: [1, 5, 10, 20] },
    FRIENDSHIP_MAX: 255,
    /* 蛋招式孵化解锁几率：标准池 / 招式 UP 蛋池 */
    EGG_UNLOCK_RATES: { common: 0.20, rare: 0.05, eggUpCommon: 0.40, eggUpRare: 0.15 },
    /* 数据文件（classic script 懒加载，file:// 兼容） */
    DATA_FILES: {
      core: 'data/pokemon-data.js',
      moves: 'data/moves-data.js',
      learnset: g => 'data/learnsets-gen' + g + '.js'
    },
    /* 属性中文名 */
    TYPE_ZH: {
      normal: '一般', fire: '火', water: '水', electric: '电', grass: '草',
      ice: '冰', fighting: '格斗', poison: '毒', ground: '地面', flying: '飞行',
      psychic: '超能力', bug: '虫', rock: '岩石', ghost: '幽灵', dragon: '龙',
      dark: '恶', steel: '钢', fairy: '妖精'
    },
    /* 五维下标中文名（性格修正说明用，下标约定见 js/modules/stats.js） */
    STAT_ZH: ['物攻', '物防', '特攻', '特防', '速度']
  }
};
