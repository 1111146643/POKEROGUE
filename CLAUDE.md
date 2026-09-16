# POKEROGUE · 宝可梦肉鸽网页游戏

## 产品概述

一款宝可梦主题的肉鸽（Roguelike）网页游戏。玩家以训练家身份进入游戏，通过关卡冒险、收集宝可梦、挑战强敌，每次冒险的过程与选择都会产生不同走向。

- 平台：网页（浏览器），支持双击 `index.html` 直接运行
- 语言：中文 UI
- 风格：宝可梦主题（精灵球视觉元素、18 种属性色板、官方像素精灵图）

## 产品需求

### 第一期（已实现 ✅）

> 以下需求按用户原始表述记录，并补充技术约束与决策。

| 编号 | 需求 | 实现要点 |
|---|---|---|
| REQ-1 | 资源加载页面，显示游戏资源的加载进度 | 真实预加载 26 张 PokéAPI 精灵图（`Image()` + 计数）；精灵球主题进度条（红白渐变填充 + 小精灵球随进度滚动）；百分比 + `x/y 张` 计数；宝可梦贴士每 3s 轮换；随机宝可梦剪影（`filter: brightness(0)`）；最短展示 1.5s 防闪屏；单图 15s 超时防挂起 |
| REQ-2 | 加载完成后跳转到登录注册界面 | 淡入淡出过渡（`.screen` 切换，0.45s） |
| REQ-3 | 加载页与登录注册页有丰富的宝可梦元素 | 纯 CSS 精灵球（普通/超级/高级球三色变体）、漂浮动画装饰球、低透明度宝可梦 sprite 装饰、属性色主题（登录 Tab=水系蓝、注册 Tab=火系红）、精灵球风格提交按钮（hover 抖动） |
| REQ-4 | 登录注册之后跳转到游戏初始界面 | 表单前端校验通过后进入主菜单；昵称存 localStorage，主菜单打招呼显示昵称 |
| REQ-5 | 主菜单（初始界面） | 数据驱动菜单卡片：新的冒险 / 继续冒险（置灰） / 宝可梦图鉴 / 设置（后两项带"敬请期待"角标，点击弹 toast 占位） |

**用户确认的技术约束：**

1. 纯 HTML/CSS/JS，无构建工具、无框架、无 npm 依赖
2. 登录注册**仅界面占位**：前端校验（用户名 2-12 位中英文/数字/下划线；密码 8-20 位且含字母和数字；确认密码一致；密码强度 0-4 级），提交后直接进入主菜单，无真实后端
3. 宝可梦素材用在线 PokéAPI 官方图（`raw.githubusercontent.com/PokeAPI/sprites`），界面元素（精灵球等）纯 CSS 绘制
4. 默认深色主题（深夜蓝），浅色主题机制已预留（`body[data-theme]`）

### 需求池（待用户逐步提出）

- 肉鸽核心玩法：御三家选择、战斗系统、地图/关卡、道具与事件（用户将逐条提出需求）
- 真实账号系统（当前 localStorage 占位，后续可无缝替换为后端）
- 存档系统（"继续冒险"当前置灰）
- 宝可梦图鉴、设置面板（当前为占位入口）

## 技术架构

### 文件结构

```
index.html                  # 单页骨架：三屏 section + CSS/JS 引用（唯一 HTML）
css/
  base.css                  # reset、CSS 变量（18 属性色板/主题）、字体栈、工具类
  components.css            # 精灵球、按钮、卡片、表单控件、进度条、toast、剪影/骨架占位
  screens.css               # 三屏布局 + screen 切换过渡动画 + 每屏装饰
js/
  config.js                 # 纯数据常量：预加载 id 列表、贴士文案、事件名、菜单项
  utils.js                  # 工具函数、EventBus、安全 storage、toast、表单校验
  screen-manager.js         # ScreenManager：屏幕注册/切换/过渡
  sprite.js                 # PokeSprite：精灵图统一渲染 + 失败剪影降级
  loading.js                # 加载屏：预加载队列、进度、贴士/剪影轮换
  auth.js                   # 登录/注册屏：Tab、校验、密码强度、昵称存取
  menu.js                   # 主菜单屏：欢迎语、菜单卡片
  app.js                    # 入口：初始化 state、注册三屏、go('loading')
```

### 核心机制

- **命名空间**：全部代码挂 `window.PKR`，各文件自报家门（`PKR.Loading = ...`）
- **脚本加载**：普通 `<script defer>` 按 config → utils → screen-manager → sprite → loading → auth → menu → app 顺序加载。**不用 ES modules**（file:// 下被 CORS 拦截）
- **屏幕管理**：`PKR.ScreenManager.register(name, { el, onEnter, onExit })` + `go(name, params) → Promise`。CSS `.screen.active` 类控制 opacity/visibility/pointer-events，JS 加类后强制 reflow 保证过渡触发，`setTimeout(500)` 兜底 resolve
- **全局状态**：`PKR.state = { player, preload, theme }` 普通对象直读直写
- **事件总线**：`PKR.EventBus.on/off/emit`，事件名常量在 config.js 的 `EVENTS`
- **精灵图渲染**：统一走 `PKR.Sprite.render(id, { cls, alt })`；预加载失败的 id 自动降级为 CSS 剪影占位（`.pkm-silhouette`）；预加载过的 URL 命中浏览器缓存
- **离线降级三铁律**：onerror 计入进度 / 单图 15s 超时 / 失败 id 进 `PKR.state.preload.failedIds` 统一降级

### 关键约束与坑

- file:// 下 localStorage 可能抛 SecurityError → 一律用 `PKR.storage` 封装（异常回退内存 Map）
- 剪影滤镜 `brightness(0)` 对未加载完成的 img 无效 → 先显示骨架块（`.sprite-skeleton`）
- 表单提交用 form 的 `submit` 事件（保证回车可提交）；实时校验防抖 300ms
- 所有 `setInterval` 必须在屏幕 `onExit` 清理
- `prefers-reduced-motion` 下所有动画归零，保证可用性
- 字体：英文品牌词/数字用 Press Start 2P（Google Fonts）；中文用 Fusion Pixel 12px SC（Fontsource CDN）；长中文正文用系统字体栈；放大精灵图加 `image-rendering: pixelated`

## 宝可梦个体系统（二期）

### 术语映射

- **天赋值 = 个体值（IV）**：每只个体六维各 0-31
- **属性值 = 实际属性**：由种族值 + IV + 性格修正 + 等级按官方公式计算
- **好感度（friendship）**：0-255，满值换 1 糖果后重置；糖果图标随好感度填充
- **闪光三档**：黄闪（×5 糖果）< 蓝闪（×10）< 红闪（×20）；Boss ×2

### 数据管线

```bash
node scripts/build-data.mjs [--limit N] [--force] [--rate N] [--no-learnset]
```

- 从 PokéAPI 拉取 9 世代全部宝可梦（约 1025 只）+ 招式（约 900）+ 特性，生成 `data/*.js`
- 响应缓存于 `scripts/.cache/`（gitignore），支持断点续跑；全量一次性约 30-45 分钟
- 中文名三级回退 zh-Hans → zh-Hant → en；游戏专属字段（cost/蛋招式/被动）由规则生成，**手工调整一律写 `scripts/data-overrides.json`**（`data/*.js` 为自动生成勿手改）
- 关键规则：cost = clamp(1+floor((BST-200)/55), 1, 10)；蛋招式 = 技能池并集按种子 PRNG 抽 3 普通（power≤80）+1 稀有（power>80），确定性可重建

### 逻辑模块（js/modules/，UMD 可 node 测试）

`PKR.stats`（属性公式/25 性格）、`PKR.candy`（糖果倍率/好感度进度）、`PKR.eggMoves`（孵化解锁判定）、`PKR.individual`（个体生成/闪光判定）、`PKR.PokedexStore`（存档读写，浏览器专用）。测试：`node scripts/test-logic.mjs`。闪光概率/蛋招式几率/糖果倍率等平衡数值集中在 `PKR.config.POKEDEX`，调数值不碰代码。

### 图鉴屏约定

- 数据文件走 classic script 懒加载（`PKR.Pokedex` 内 ensureDataFile，按文件名缓存 Promise），**不挂 script 标签直接引入**
- 闪光三档当前为 CSS 滤镜占位（`.shiny-filter--*`），后续替换真实素材仅换 URL
- 蛋招式锁定态读 `pkrogue.eggUnlocks`；糖果总数读 `pkrogue.candies`

## 开发约定（后续迭代遵循）

1. 新界面 = 新 `data-screen` section + 新 js 文件（`PKR.Xxx = {...init()}` 模式）+ screens.css 追加布局，在 app.js 注册并 `init()`
2. 新配置项（预加载列表、贴士、菜单、事件名）一律放 config.js，不散落在业务代码
3. 所有宝可梦图片渲染必须经 `PKR.Sprite.render`，不允许手写 `<img>` 拼 URL
4. 界面文案使用中文；像素字体只用于短标签/数字/英文品牌词
5. 新增图片素材先加入 `PRELOAD_POKEMON_IDS` 预加载，保证后续界面命中缓存

## 运行与发布

```bash
# 开发预览（推荐）
cd /Users/nitouche/POKEROGUE && python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

- 兼容路径：Finder 双击 `index.html`（file:// 模式已适配）
- 发布：推送到 GitHub（`git push origin main`，已配置 SSH 免密）

## Git 仓库

- 远程：`git@github.com:1111146643/POKEROGUE.git`（SSH，免密）
- 分支：`main`；提交信息中文描述 + `Co-Authored-By: Claude Code` 署名
