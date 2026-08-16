/**
 * dsh-plugin-outline — browser half (zero-build: hand-maintained source AND
 * shipped artifact, in the window.__ModuleLoader__ handoff format).
 *
 * Registers one entry into the `shell.overlay` seat (a root-scoped list slot
 * owned by ui-layout's AppFrame): a right-edge quick navigation over the
 * current conversation — one small dash per user turn with the reading
 * position highlighted; hovering or clicking expands an outline panel of
 * turn snippets; clicking a row scrolls that turn into view.
 *
 * Turn discovery is DOM-based (the conversation flow's stable data attributes:
 * [data-conversation-scroll], [data-chat-flow-kind="user"]) so the plugin
 * stays decoupled from the conversation snapshot API surface.
 *
 * Theming follows the official signal — body[data-ds-dark-theme], written by
 * dsh's ThemePresenter (ui-theme) and by chat.deepseek.com alike — with a
 * luminance fallback for hosts that predate the attribute.
 *
 * Visual language is a 1:1 reimplementation of chat.deepseek.com's own
 * scroll-nav component (classes _189b4a0/_6ffc3c9/_4ce999d/_81e7b5e in the
 * production stylesheet, commit e444e47): a fixed 34px frosted pill at
 * right:16px holding one 8x2 dash per 30px row; the outline panel is the same
 * DOM with a transparent background that gains bg-layer-1 + shadow-lv3 on
 * open while the 13px/20px snippets fade in. Tokens resolve against the host
 * page's --dsw / --ds custom properties with official fallbacks.
 */
window.__ModuleLoader__.load({
	id: "dsh-plugin-outline",
	factory: (require) => {
		const React = require("react");
		const { useCallback, useEffect, useLayoutEffect, useRef, useState } = React;
		const h = React.createElement;

		const NAV_ID = "dsh-outline-root";
		const ROW_H = 30; // official .ol-row height (turn pitch)
		const PAD_V = 15; // official scroll-nav page padding (top/bottom)
		const RAIL_H = 300; // official fixed rail height (._189b4a0 height:300px)

		const CSS = `
		/* Rail = official ._189b4a0: fixed right-edge column, vertically centered. */
		#${NAV_ID} {
			position: fixed;
			top: 50%;
			right: 16px;
			transform: translateY(-50%);
			z-index: 5;
			width: 34px;
			display: flex;
			align-items: center;
			user-select: none;
			transition: all var(--ol-dur) var(--ol-ease);
			pointer-events: auto;

			/* --- DeepSeek official tokens, with commit-e444e47 fallback values --- */
			--ol-ease: var(--ds-ease-in-out, cubic-bezier(0.4, 0, 0.2, 1));
			--ol-dur: var(--ds-transition-duration, 0.2s);
			--ol-font: var(--dsw-font-family, "quote-cjk-patch", "Inter", system-ui,
				-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu,
				Cantarell, "Open Sans", "Helvetica Neue", sans-serif);
			--ol-label-1: var(--dsw-alias-label-primary, #0f1115);
			--ol-label-3: var(--dsw-alias-label-tertiary, #81858c);
			--ol-brand-text: var(--dsw-alias-brand-text, #3964fe);
			--ol-dot: var(--dsw-alias-border-l4, rgba(0, 0, 0, 0.16));
			--ol-panel-bg: var(--dsw-alias-bg-layer-1, #ffffff);
			--ol-border-inv: var(--dsw-alias-border-inverted, transparent);
			/* dsw-shadow-lv3 — official elevated-surface shadow */
			--ol-shadow: 0 0 1px rgba(0, 0, 0, 0.2), 0 0 4px rgba(0, 0, 0, 0.02),
				0 12px 32px rgba(0, 0, 0, 0.08);
			font-family: var(--ol-font);
		}
		@media not all and (min-width: 1024px) {
			#${NAV_ID} { display: none; }
		}
		#${NAV_ID}.ol-dark {
			--ol-label-1: var(--dsw-alias-label-primary, #f9fafb);
			--ol-label-3: var(--dsw-alias-label-tertiary, #adb2b8);
			--ol-brand-text: var(--dsw-alias-brand-text, #679efe);
			--ol-dot: var(--dsw-alias-border-l4, rgba(255, 255, 255, 0.2));
			--ol-panel-bg: var(--dsw-alias-bg-layer-1, #232324);
			--ol-border-inv: var(--dsw-alias-border-inverted, rgba(255, 255, 255, 0.06));
			--ol-shadow: 0 0 1px rgba(0, 0, 0, 0.6), 0 0 4px rgba(0, 0, 0, 0.12),
				0 12px 32px rgba(0, 0, 0, 0.32);
		}
		/* Pill = official ._6ffc3c9: frosted 34px track behind the dashes. */
		#${NAV_ID} .ol-pill {
			position: absolute;
			top: 50%;
			right: 0;
			transform: translateY(-50%);
			z-index: -1;
			width: 34px;
			height: calc(100% - 8px);
			max-height: calc(100% - 8px);
			border-radius: 16px;
			background-color: rgba(255, 255, 255, 0.8);
			-webkit-backdrop-filter: blur(5px);
			backdrop-filter: blur(5px);
			transition: background-color var(--ol-dur) var(--ol-ease);
		}
		#${NAV_ID}.ol-dark .ol-pill {
			background-color: rgba(21, 21, 23, 0.6);
		}
		/* Panel = official ._4ce999d: same DOM in both states — transparent and
		   inert when closed; gains the elevated surface when open. */
		#${NAV_ID} .ol-panel {
			position: absolute;
			top: 50%;
			right: 0;
			transform: translateY(-50%);
			display: flex;
			flex-direction: column;
			align-items: stretch;
			width: fit-content;
			max-width: 240px;
			max-height: 100%;
			border: 1px solid transparent;
			border-radius: 16px;
			overflow: hidden;
			pointer-events: none;
			transition: background-color var(--ol-dur) var(--ol-ease),
				box-shadow var(--ol-dur) var(--ol-ease);
		}
		#${NAV_ID}.ol-open .ol-panel {
			pointer-events: auto;
			width: 240px;
			background: var(--ol-panel-bg);
			box-shadow: var(--ol-shadow);
			border-color: var(--ol-border-inv);
		}
		/* Fade masks = official :before/:after, only when open and clipped. */
		#${NAV_ID} .ol-panel::before,
		#${NAV_ID} .ol-panel::after {
			content: "";
			z-index: 2;
			pointer-events: none;
			opacity: 0;
			background: linear-gradient(#ffffff 20.19%, rgba(255, 255, 255, 0) 100%);
			width: 100%;
			height: 32px;
			transition: opacity var(--ol-dur) var(--ol-ease);
			position: absolute;
			left: 0;
		}
		#${NAV_ID}.ol-dark .ol-panel::before,
		#${NAV_ID}.ol-dark .ol-panel::after {
			background: linear-gradient(180deg, #232324 20.19%, rgba(35, 35, 36, 0) 100%);
		}
		#${NAV_ID} .ol-panel::before { top: 0; }
		#${NAV_ID} .ol-panel::after { bottom: 0; transform: rotate(180deg); }
		#${NAV_ID}.ol-open.ol-clipped .ol-panel::before,
		#${NAV_ID}.ol-open.ol-clipped .ol-panel::after { opacity: 1; }
		/* List = official scroll-nav page padding (15px 0 15px 24px). */
		#${NAV_ID} .ol-list {
			overflow-y: auto;
			overflow-x: hidden;
			padding: ${PAD_V}px 0 ${PAD_V}px 24px;
			scrollbar-width: thin;
			scrollbar-color: var(--ol-label-3) transparent;
		}
		#${NAV_ID} .ol-list::-webkit-scrollbar { width: 4px; }
		#${NAV_ID} .ol-list::-webkit-scrollbar-thumb {
			background: var(--ol-dot);
			border-radius: 4px;
		}
		/* Row = official ._81e7b5e: 30px tall, right-aligned snippet + dash. */
		#${NAV_ID} .ol-row {
			display: flex;
			justify-content: flex-end;
			align-items: center;
			height: ${ROW_H}px;
			width: calc(100% - 6px);
			margin-right: 8px;
			line-height: 20px;
			color: var(--ol-label-3);
			cursor: pointer;
		}
		#${NAV_ID} .ol-txt {
			font-family: var(--ol-font);
			font-size: var(--ds-font-size-sp, 13px);
			line-height: 20px;
			font-weight: 400;
			color: inherit;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			opacity: 0;
			margin-right: 12px;
			transition: opacity 0.1s var(--ol-ease), color var(--ol-dur) var(--ol-ease);
		}
		#${NAV_ID}.ol-open .ol-txt { opacity: 1; }
		#${NAV_ID} .ol-row:hover .ol-txt { color: var(--ol-label-1); }
		#${NAV_ID} .ol-row.ol-on .ol-txt {
			color: var(--ol-brand-text);
			font-weight: 500;
		}
		/* Dash = official .fae5876e: 8x2 rounded bar inside a 16px flex slot,
		   active scales 1.5x. */
		#${NAV_ID} .ol-dot {
			flex-shrink: 0;
			width: 8px;
			height: 2px;
			border-radius: 4px;
			margin-right: 4px;
			background-color: var(--ol-dot);
			transition: background-color var(--ol-dur) var(--ol-ease),
				transform var(--ol-dur) var(--ol-ease);
		}
		#${NAV_ID} .ol-row:hover .ol-dot { background-color: var(--ol-label-1); }
		#${NAV_ID} .ol-row.ol-on .ol-dot {
			background-color: var(--ol-brand-text);
			transform-origin: 50%;
			transform: scale(1.5);
		}
		`;

		/** The conversation scroll host and its user-turn rows, or null off-chat. */
		function findParts() {
			const host = document.querySelector("[data-conversation-scroll]");
			if (host === null) return null;
			let scrollEl = null;
			if (/(auto|scroll)/.test(getComputedStyle(host).overflowY)
				|| host.scrollHeight > host.clientHeight + 20) scrollEl = host;
			if (scrollEl === null) scrollEl = host.querySelector('div[class*="_scrollBody"]');
			if (scrollEl === null) {
				for (const el of host.querySelectorAll("div")) {
					if (el.scrollHeight > el.clientHeight + 20
						&& /(auto|scroll)/.test(getComputedStyle(el).overflowY)) {
						scrollEl = el;
						break;
					}
				}
			}
			const users = Array.from(host.querySelectorAll('[data-chat-flow-kind="user"]'))
				.filter((el) => el.textContent !== null && el.textContent.trim() !== "");
			if (scrollEl === null || users.length === 0) return null;
			return { host, scrollEl, users };
		}

		/** First line of a turn, whitespace-flattened, for the outline row. */
		function snippet(el) {
			return (el.innerText || el.textContent || "")
				.replace(/\s+/g, " ")
				.replace(/^ +/, "")
				.slice(0, 140);
		}

		/** Walk up to the first opaque background and luminance-test it. */
		function isDarkTheme(el) {
			let node = el;
			while (node !== null && node !== document.documentElement) {
				const c = getComputedStyle(node).backgroundColor;
				if (c !== null && !c.includes("0, 0, 0, 0") && c !== "transparent") {
					const m = c.match(/(\d+)[, ]+(\d+)[, ]+(\d+)/);
					if (m === null) return false;
					const r = Number(m[1]), g = Number(m[2]), b = Number(m[3]);
					return (r * 299 + g * 587 + b * 114) / 1000 < 128;
				}
				node = node.parentElement;
			}
			return false;
		}

		/**
		 * Official dark signal first: body[data-ds-dark-theme] (set by dsh's
		 * ThemePresenter and by chat.deepseek.com). Luminance probe as fallback.
		 */
		function detectTheme(el) {
			if (document.body.hasAttribute("data-ds-dark-theme")
				|| document.documentElement.hasAttribute("data-ds-dark-theme")) return true;
			return isDarkTheme(el);
		}

		/** The overlay entry: renders nothing until a conversation with turns exists. */
		function OutlineNav() {
			const rootRef = useRef(null);
			const listRef = useRef(null);
			const partsRef = useRef(null);
			const rafPending = useRef(false);
			const [turns, setTurns] = useState([]); // [{ key, text }]
			const [active, setActive] = useState(0);
			const [open, setOpen] = useState(false);
			const [pinned, setPinned] = useState(false);
			const [dark, setDark] = useState(false);
			const [clipped, setClipped] = useState(false);

			const track = useCallback(() => {
				const parts = partsRef.current;
				if (parts === null || parts.users.length === 0) return;
				const scRect = parts.scrollEl.getBoundingClientRect();
				const probe = scRect.top + Math.min(scRect.height, window.innerHeight) * 0.35;
				let idx = 0;
				parts.users.forEach((el, i) => {
					if (el.getBoundingClientRect().top <= probe) idx = i;
				});
				setActive(idx);
			}, []);

			useLayoutEffect(() => {
				const list = listRef.current;
				if (list !== null) setClipped(list.scrollHeight > list.clientHeight + 1);
			}, [turns, open]);

			useEffect(() => {
				const st = document.createElement("style");
				st.textContent = CSS;
				document.head.appendChild(st);

				let refreshTimer = null;
				const refresh = () => {
					const parts = findParts();
					partsRef.current = parts;
					if (parts === null) {
						setTurns([]);
						return;
					}
					setDark(detectTheme(parts.scrollEl));
					setTurns(parts.users.map((el, i) => ({ key: el.dataset.chatFlowKey ?? String(i), text: snippet(el) })));
					track();
				};
				const schedule = () => {
					if (refreshTimer !== null) return;
					refreshTimer = setTimeout(() => { refreshTimer = null; refresh(); }, 300);
				};

				const onScroll = () => {
					if (rafPending.current) return;
					rafPending.current = true;
					requestAnimationFrame(() => { rafPending.current = false; track(); });
				};
				const onResize = () => { track(); };
				const onKey = (e) => {
					if (e.key === "Escape") { setPinned(false); setOpen(false); }
				};
				const onDocClick = (e) => {
					const root = rootRef.current;
					if (root !== null && !root.contains(e.target)) { setPinned(false); setOpen(false); }
				};

				const mo = new MutationObserver(schedule);
				mo.observe(document.body, { childList: true, subtree: true });
				// body-level attribute flips: the official theme signal (no subtree,
				// so React re-render class churn stays quiet).
				const moTheme = new MutationObserver(schedule);
				moTheme.observe(document.body, {
					attributes: true,
					attributeFilter: ["data-ds-dark-theme", "class"],
				});
				document.addEventListener("keydown", onKey);
				document.addEventListener("click", onDocClick, true);
				window.addEventListener("resize", onResize);
				const attachScroll = () => {
					const parts = partsRef.current;
					parts?.scrollEl.addEventListener("scroll", onScroll, { passive: true });
				};
				const interval = setInterval(() => {
					// Re-attach when the app swaps the conversation host between sessions.
					const parts = partsRef.current;
					if (parts !== null && !document.contains(parts.scrollEl)) refresh();
					attachScroll();
					if (partsRef.current === null || findParts() === null) schedule();
				}, 2000);

				refresh();
				attachScroll();

				return () => {
					mo.disconnect();
					moTheme.disconnect();
					clearInterval(interval);
					if (refreshTimer !== null) clearTimeout(refreshTimer);
					document.removeEventListener("keydown", onKey);
					document.removeEventListener("click", onDocClick, true);
					window.removeEventListener("resize", onResize);
					const parts = partsRef.current;
					parts?.scrollEl.removeEventListener("scroll", onScroll);
					st.remove();
				};
			}, [track]);

			const jump = (i) => {
				const parts = partsRef.current;
				if (parts === null) return;
				const el = parts.users[i];
				if (el === undefined) return;
				// Official behavior: smooth scroll only, no highlight flash.
				el.scrollIntoView({ behavior: "smooth", block: "start" });
				if (!pinned) setOpen(false);
			};

			// Official open/close behavior: both immediate on pointer enter/leave
			// (live-probed on chat.deepseek.com — class flips within one frame).
			const openNow = () => { setOpen(true); };
			const closeSoon = () => { if (!pinned) setOpen(false); };

			if (turns.length === 0) return null;

			return h("div", {
				id: NAV_ID,
				ref: rootRef,
				className: `${open ? "ol-open " : ""}${dark ? "ol-dark " : ""}${clipped ? "ol-clipped" : ""}`.trim(),
				style: { height: `${RAIL_H}px` },
				onMouseEnter: openNow,
				onMouseLeave: closeSoon,
				onDoubleClick: () => { setPinned((v) => !v); },
			},
				h("div", { className: "ol-pill" }),
				h("div", { className: "ol-panel" },
					h("div", { className: "ol-list", ref: listRef },
						turns.map((t, i) => h("div", {
							key: t.key,
							className: `ol-row${i === active ? " ol-on" : ""}`,
							title: t.text,
							onClick: () => { jump(i); },
						},
							h("span", { className: "ol-txt" }, t.text),
							h("span", { className: "ol-dot" }),
						)),
					),
				),
			);
		}

		/** Services required: the slot service (provided by dsh-client-runtime). */
		const inject = ["slots"];

		/**
		 * Register the outline entry into the shell.overlay seat. The effect
		 * wrapper removes the entry when the plugin unloads.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			ctx.effect(
				() => ctx.slots.register({ name: "shell.overlay", id: "outline", order: 20 }, OutlineNav),
				"outline: slot registration",
			);
		}

		return { inject, apply };
	},
});
