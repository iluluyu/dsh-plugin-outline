# Theme Plan: Liquid Glass / Frosted Glass Variants

Status: proposal (not yet implemented)
Scope: `lib/client.js` outline panel + dash stack styling only
Baseline: the current default is **official parity** — the panel reproduces the
production `ds-dropdown-menu` of chat.deepseek.com 1:1 (`bg-layer-3`, radius 12,
padding 4, shadow lv3, opaque, no border). Glass variants are opt-in extras and
must never change that default.

## 1. Background

- dsh themes switch via the official signal `body[data-ds-dark-theme]`
  (ThemePresenter, `packages/client/ui-theme`). The plugin already follows it.
- The host page carries the full `--dsw-alias-*` token set; the plugin resolves
  tokens live with fallbacks, so glass tints must also derive from tokens, not
  hard-coded colors.
- Community themes often introduce background wallpapers/gradents; an opaque
  panel visually "floats dead" on them. `backdrop-filter` glass keeps content
  legible while letting the artwork show through.
- Constraint: third-party plugins cannot use the settings RPC
  (`WEB_SETTINGS_NAMESPACES` whitelist in `packages/host/apiproxy`). Activation
  therefore uses `localStorage`.

## 2. Variants

| Variant | Panel background | Backdrop | Border | Shadow | Feel |
|---|---|---|---|---|---|
| `off` (default) | `var(--dsw-alias-bg-layer-3, …)` opaque | none | none | `dsw-shadow-lv3` | official DeepSeek menu |
| `frost` (frosted) | `bg-layer-3` @ 72% alpha | `blur(14px) saturate(1.4)` | `1px border-l1` | `lv3` | macOS-like milk glass |
| `liquid` (liquid glass) | brand-tinted gradient @ 52–64% alpha | `blur(20px) saturate(1.8)` | `1px rgba(255,255,255,.35)` top-lit + inner highlight | `lv3` + `inset 0 1px 0 rgba(255,255,255,.25)` | iOS 26-style specular glass |

Dark theme rules: alpha rises (light artwork bleeds through more), the top-lit
border dims to `rgba(255,255,255,.16)`, tint shifts toward
`--dsw-alias-brand-primary` (deepseek-500) instead of white.

### Draft CSS (frost)

```css
#dsh-outline-root[data-ol-glass="frost"] .ol-panel {
	background: color-mix(in srgb, var(--ol-bg-panel) 72%, transparent);
	-webkit-backdrop-filter: blur(14px) saturate(1.4);
	backdrop-filter: blur(14px) saturate(1.4);
	border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.04));
}
```

### Draft CSS (liquid)

```css
#dsh-outline-root[data-ol-glass="liquid"] .ol-panel {
	background:
		linear-gradient(160deg,
			color-mix(in srgb, var(--ol-brand) 8%, transparent) 0%,
			transparent 38%),
		color-mix(in srgb, var(--ol-bg-panel) 60%, transparent);
	-webkit-backdrop-filter: blur(20px) saturate(1.8);
	backdrop-filter: blur(20px) saturate(1.8);
	border: 1px solid rgba(255, 255, 255, 0.35);
	box-shadow: var(--ol-shadow), inset 0 1px 0 rgba(255, 255, 255, 0.25);
}
#dsh-outline-root[data-ol-glass="liquid"].ol-dark .ol-panel {
	border-color: rgba(255, 255, 255, 0.16);
}
```

Dash-stack hover chip may opt into the same treatment at lower alpha (55%).

## 3. Activation & Discovery

- `localStorage["dsh-outline.glass"] = "off" | "frost" | "liquid"`, read on
  mount and on a `storage` listener (multi-tab sync). The root element carries
  `data-ol-glass="<variant>"`.
- Defaults stay `off`. A future `settings.section` slot UI could expose the
  toggle in-app (slots are available to plugins; RPC settings are not).
- Respect `prefers-reduced-transparency` where supported → force `off`.

## 4. Compatibility & Performance

- Wrap each glass rule in `@supports (backdrop-filter: blur(1px))` and provide
  the opaque default outside the block — browsers without support (old FF)
  silently keep official parity.
- `backdrop-filter` costs one screen-space blur per frame while visible; the
  panel is a 280×≤520 px overlay, and dashes stay opaque, so cost is bounded.
  Avoid animating `backdrop-filter` itself; animate only opacity/transform.
- `color-mix` is already used (baseline `.ol-on` previously relied on it);
  keep the `@supports` guard consistent.

## 5. Verification Checklist

1. `test/parity.html` grows two cards per theme (`frost`, `liquid`) asserting:
   computed `backdrop-filter`, background alpha, border color; fallback card
   (no `color-mix`/`backdrop-filter`) stays opaque.
2. Demo screenshot set per variant × light/dark into `docs/img/` for README.
3. Real-page injection run (see README dev notes) with each variant toggled.
4. Reduced-transparency media query forces `off`.

## 6. Implementation Steps

1. Add the two `@supports`-guarded variant blocks + `data-ol-glass` hooks to
   the `CSS` constant in `lib/client.js` (~40 lines, zero logic change).
2. Read/apply the localStorage key in `OutlineNav` (state + `storage` event).
3. Extend `test/make-parity.py` and regenerate `test/parity.html`.
4. Capture screenshots; update README (bilingual) with a variant table.
5. Ship as 0.2.0 (minor: new opt-in capability, no behavior change by default).
