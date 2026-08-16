# dsh-plugin-outline

ChatGPT-style right-edge quick navigation for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) web — one dash per user turn, reading position highlighted, hover to expand an outline panel, click to jump.

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）web 端提供的 ChatGPT 式右侧快速导航——每轮用户消息一条横线，实时高亮阅读位置，悬停展开大纲面板，点击跳转。

| Light | Dark |
|:---:|:---:|
| ![light demo](https://raw.githubusercontent.com/iluluyu/dsh-plugin-outline/main/docs/img/demo-light.png) | ![dark demo](https://raw.githubusercontent.com/iluluyu/dsh-plugin-outline/main/docs/img/demo-dark.png) |

*Both shots are the real 0.2.1 artifact running on chat.deepseek.com's live share page — the plugin rail overlays exactly where the site's own scroll-nav sits (pixel-verified: same rect, tokens and transitions). 两图均为 0.2.1 真实产物运行在 chat.deepseek.com 线上分享页——插件导航与官网自带 scroll-nav 位置完全重合（几何、token、动效均逐像素验证）。*

---

## English

### Features

- **One dash per user turn** inside a 34px frosted pill pinned at the right edge (`right:16px`, vertically centered) — a faithful reimplementation of chat.deepseek.com's own scroll-nav: 8×2 rounded dashes at a 30px pitch, the active one colored brand blue and scaled 1.5×.
- **Hover or click** the pill to expand the outline panel (240px, `bg-layer-1` + `shadow-lv3`, radius 16); snippets (13px/20px, no index numbers) fade in next to their dashes; click a row to smooth-scroll that turn into view.
- **Pixel-faithful theming**: every color, font, radius, shadow and motion curve is taken from chat.deepseek.com's own design tokens (`--dsw-alias-*` / `--ds-*`), resolved live from the host page with official fallbacks — light and dark (frosted pill `rgba(255,255,255,.8)` / `rgba(21,21,23,.6)`, both `blur(5px)`).
- **Official theme signal**: follows `body[data-ds-dark-theme]` (the attribute dsh's ThemePresenter and DeepSeek's site both use), with a luminance fallback for older hosts.
- Auto-hides below 1024px viewport width, like the official nav. `Esc` / outside-click closes; double-click the pill to pin.

### Install

```sh
dsh plugin --profile web add dsh-plugin-outline        # from npm
# or from GitHub:
dsh plugin --profile web add github:iluluyu/dsh-plugin-outline
```

Restart `dsh web` and reload the browser. Uninstall with `dsh plugin --profile web remove dsh-plugin-outline`.

### How it works

Zero-build package: `lib/` is both source and shipped artifact.

| File | Role |
|---|---|
| `cordis.yml` | bundle patch: inserts one loader row into the Web profile |
| `lib/index.js` | node half (host loader entry, no behavior) |
| `lib/client.js` | browser half (`__ModuleLoader__` handoff): registers the nav component into the `shell.overlay` seat |

Turn discovery is DOM-based (`[data-conversation-scroll]`, `[data-chat-flow-kind="user"]`, stable `data-chat-flow-key`), decoupled from the conversation snapshot API.

### Design parity

The component reimplements the site's scroll-nav (`_189b4a0` in the production stylesheet) part for part: the fixed 34px rail at `right:16px`, the frosted `blur(5px)` pill, 8×2px dashes (radius 4, `border-l4`, active `brand-text` ×1.5), the transparent→`bg-layer-1` panel with `shadow-lv3` and 16px radius, 30px rows with right-aligned 13px/20px snippets, immediate hover-open/leave-close, scroll fade masks, and the `0.2s cubic-bezier(.4,0,.2,1)` motion. Verified three ways: a computed-style parity fixture (`test/parity.html`), live side-by-side injection against the official component (identical geometry), and real-pointer interaction tests. See `docs/theme-plan.md` for planned opt-in glass variants (frosted / liquid).

### Development

```sh
node --check lib/client.js          # syntax gate (zero-build)
python3 test/make-parity.py         # regenerate test/parity.html from CSS
```

`test/parity.html` asserts computed styles in four cards (light/dark × fallback/host-tokens) against the official values.

---

## 中文

### 功能

- 右缘 34px 毛玻璃胶囊（`right:16px` 垂直居中）内**每轮用户消息一条 8×2 小横线**，30px 节奏——逐件复刻 chat.deepseek.com 自带的 scroll-nav；当前阅读位置的横线以品牌蓝高亮并放大 1.5 倍，跟随滚动实时更新。
- 悬停或点击胶囊**展开 240px 大纲面板**（`bg-layer-1` + `shadow-lv3`、圆角 16），摘要（13px/20px，无序号）在横线旁淡入；点击条目平滑滚动到对应消息。
- **像素级主题对齐**：所有颜色、字体、圆角、阴影、动效曲线均取自官网设计 token（`--dsw-alias-*` / `--ds-*`），优先实时读取宿主页面变量、官方实测值兜底；胶囊明 `rgba(255,255,255,.8)` / 暗 `rgba(21,21,23,.6)`，均 `blur(5px)`。
- **官方主题信号**：跟随 `body[data-ds-dark-theme]`（dsh ThemePresenter 与官网同款属性）切换，旧宿主自动回退亮度探测。
- 视口 <1024px 自动隐藏（与官方一致）；`Esc` / 点击外部关闭；双击胶囊固定。

### 安装

```sh
dsh plugin --profile web add dsh-plugin-outline        # npm
# 或 GitHub：
dsh plugin --profile web add github:iluluyu/dsh-plugin-outline
```

重启 `dsh web` 并刷新浏览器。卸载：`dsh plugin --profile web remove dsh-plugin-outline`。

### 工作原理

零构建包：`lib/` 既是源码也是发布产物。

| 文件 | 角色 |
|---|---|
| `cordis.yml` | bundle patch：向 Web profile 插入一行 loader 条目 |
| `lib/index.js` | node 半边（宿主加载入口，无行为） |
| `lib/client.js` | 浏览器半边（`__ModuleLoader__` 手写 bundle）：向 `shell.overlay` 插槽注册导航组件 |

轮次发现基于对话流的稳定 data 属性（`[data-conversation-scroll]`、`[data-chat-flow-kind="user"]`、稳定 `data-chat-flow-key`），不依赖快照 API。

### 设计对齐

组件逐件复刻官网 scroll-nav（生产样式表中的 `_189b4a0`）：固定 34px 宽轨道（`right:16px`）、`blur(5px)` 毛玻璃胶囊、8×2px 横线（圆角 4、`border-l4` 色、激活 `brand-text` ×1.5）、透明→`bg-layer-1` 面板（`shadow-lv3`、圆角 16）、30px 行高右对齐 13px/20px 摘要、悬停即开/离开即关、滚动渐隐遮罩、`0.2s cubic-bezier(.4,0,.2,1)` 动效。三方验证：计算样式对齐固件（`test/parity.html`）、线上与官方组件并排注入（几何完全重合）、真实指针交互测试。可选玻璃变体（毛玻璃/液态玻璃）见 `docs/theme-plan.md`。

### 开发

```sh
node --check lib/client.js          # 语法检查（零构建）
python3 test/make-parity.py         # 从 CSS 重新生成 test/parity.html
```

`test/parity.html` 以四张卡片（明/暗 × 兜底值/宿主变量）对官方值做计算样式断言。

## License

MIT
