/**
 * dsh-plugin-outline — browser half (zero-build: hand-maintained source AND
 * shipped artifact, in the window.__ModuleLoader__ handoff format).
 *
 * Registers one entry into the `shell.overlay` seat (a root-scoped list slot
 * owned by ui-layout's AppFrame): a ChatGPT-style right-edge quick navigation
 * over the current conversation — one small dash per user turn with the
 * reading position highlighted; hovering or clicking the stack expands an
 * outline panel of turn snippets; clicking a row scrolls that turn into view.
 *
 * Turn discovery is DOM-based (the conversation flow's stable data attributes:
 * [data-conversation-scroll], [data-chat-flow-kind="user"]) so the plugin
 * stays decoupled from the conversation snapshot API surface.
 */
window.__ModuleLoader__.load({
	id: "dsh-plugin-outline",
	factory: (require) => {
		const React = require("react");
		const { useCallback, useEffect, useLayoutEffect, useRef, useState } = React;
		const h = React.createElement;

		const NAV_ID = "dsh-outline-root";
		const HOVER_OPEN_MS = 350;
		const LEAVE_CLOSE_MS = 500;

		const CSS = `
		#${NAV_ID} {
			position: fixed;
			transform: translateY(-50%);
			z-index: 60;
			display: flex;
			flex-direction: column;
			align-items: flex-end;
			gap: 8px;
			font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'PingFang SC',
				'Microsoft YaHei', sans-serif;
			pointer-events: auto;
			--ol-ink: #222;
			--ol-bg: rgba(255, 255, 255, 0.92);
			--ol-dash: rgba(34, 34, 34, 0.30);
			--ol-accent: #1a7f5a;
		}
		#${NAV_ID}.ol-dark {
			--ol-ink: #e8e8e8;
			--ol-bg: rgba(30, 30, 30, 0.92);
			--ol-dash: rgba(232, 232, 232, 0.30);
		}
		#${NAV_ID} .ol-stack {
			display: flex;
			flex-direction: column;
			align-items: flex-end;
			gap: 7px;
			padding: 6px 4px;
			cursor: pointer;
			border-radius: 8px;
			transition: background 0.15s ease;
		}
		#${NAV_ID} .ol-stack:hover { background: rgba(128, 128, 128, 0.12); }
		#${NAV_ID} .ol-dash {
			width: 16px;
			height: 2px;
			border-radius: 1px;
			background: var(--ol-dash);
			transition: background 0.15s ease, width 0.15s ease;
		}
		#${NAV_ID} .ol-dash.ol-on { background: var(--ol-ink); width: 20px; }
		#${NAV_ID} .ol-panel {
			display: none;
			width: 260px;
			max-height: min(64vh, 520px);
			overflow-y: auto;
			background: var(--ol-bg);
			-webkit-backdrop-filter: blur(10px);
			backdrop-filter: blur(10px);
			border: 1px solid rgba(128, 128, 128, 0.22);
			border-radius: 12px;
			box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
			padding: 6px;
		}
		#${NAV_ID}.ol-open .ol-panel { display: block; }
		#${NAV_ID} .ol-row {
			display: flex;
			align-items: baseline;
			gap: 8px;
			padding: 6px 10px;
			border-radius: 8px;
			cursor: pointer;
			color: var(--ol-ink);
			font-size: 12px;
			line-height: 1.45;
		}
		#${NAV_ID} .ol-row:hover { background: rgba(128, 128, 128, 0.14); }
		#${NAV_ID} .ol-row.ol-on { background: color-mix(in srgb, var(--ol-accent) 16%, transparent); }
		#${NAV_ID} .ol-num {
			flex: none;
			min-width: 18px;
			font-size: 10px;
			opacity: 0.55;
			font-variant-numeric: tabular-nums;
			text-align: right;
		}
		#${NAV_ID} .ol-txt {
			flex: 1;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		#${NAV_ID} .ol-close {
			position: sticky;
			top: 4px;
			float: right;
			margin: 2px 2px 4px 0;
			width: 18px;
			height: 18px;
			border: none;
			border-radius: 6px;
			background: transparent;
			color: var(--ol-ink);
			opacity: 0;
			cursor: pointer;
			font-size: 11px;
			line-height: 18px;
			text-align: center;
		}
		#${NAV_ID}.ol-open .ol-close { opacity: 0.6; }
		#${NAV_ID} .ol-close:hover { opacity: 1; background: rgba(128, 128, 128, 0.2); }
		.ol-flash {
			outline: 2px solid #1a7f5a !important;
			outline-offset: 4px;
			border-radius: 8px;
			transition: outline-color 0.4s ease;
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

		/** The overlay entry: renders nothing until a conversation with turns exists. */
		function OutlineNav() {
			const rootRef = useRef(null);
			const partsRef = useRef(null);
			const openTimer = useRef(null);
			const closeTimer = useRef(null);
			const rafPending = useRef(false);
			const flashTimer = useRef(null);
			const [turns, setTurns] = useState([]); // [{ key, text }]
			const [active, setActive] = useState(0);
			const [open, setOpen] = useState(false);
			const [pinned, setPinned] = useState(false);
			const [dark, setDark] = useState(false);
			const [, forcePosition] = useState(0);

			const position = useCallback(() => {
				const root = rootRef.current;
				const parts = partsRef.current;
				if (root === null || parts === null || turns.length === 0) return;
				const hr = parts.host.getBoundingClientRect();
				root.style.right = `${Math.max(8, window.innerWidth - hr.right + 10)}px`;
				const mid = hr.top + hr.height / 2;
				root.style.top = `${Math.min(Math.max(mid, hr.top + 60), hr.bottom - 60)}px`;
			}, [turns.length]);

			const track = useCallback(() => {
				const parts = partsRef.current;
				if (parts === null || parts.users.length === 0) return;
				position();
				const scRect = parts.scrollEl.getBoundingClientRect();
				const probe = scRect.top + Math.min(scRect.height, window.innerHeight) * 0.35;
				let idx = 0;
				parts.users.forEach((el, i) => {
					if (el.getBoundingClientRect().top <= probe) idx = i;
				});
				setActive(idx);
			}, [position]);

			useLayoutEffect(() => { position(); }, [turns, position]);

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
					setDark(isDarkTheme(parts.scrollEl));
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
				const onResize = () => { position(); };
				const onKey = (e) => {
					if (e.key === "Escape") { setPinned(false); setOpen(false); }
				};
				const onDocClick = (e) => {
					const root = rootRef.current;
					if (root !== null && !root.contains(e.target)) { setPinned(false); setOpen(false); }
				};

				const mo = new MutationObserver(schedule);
				mo.observe(document.body, { childList: true, subtree: true });
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
					clearInterval(interval);
					if (refreshTimer !== null) clearTimeout(refreshTimer);
					document.removeEventListener("keydown", onKey);
					document.removeEventListener("click", onDocClick, true);
					window.removeEventListener("resize", onResize);
					const parts = partsRef.current;
					parts?.scrollEl.removeEventListener("scroll", onScroll);
					st.remove();
				};
			}, [track, position]);

			useEffect(() => { forcePosition(0); }, [turns]);

			const jump = (i) => {
				const parts = partsRef.current;
				if (parts === null) return;
				const el = parts.users[i];
				if (el === undefined) return;
				el.scrollIntoView({ behavior: "smooth", block: "start" });
				el.classList.add("ol-flash");
				if (flashTimer.current !== null) clearTimeout(flashTimer.current);
				flashTimer.current = setTimeout(() => el.classList.remove("ol-flash"), 900);
				if (!pinned) setTimeout(() => setOpen(false), 700);
			};

			const openNow = () => {
				if (closeTimer.current !== null) { clearTimeout(closeTimer.current); closeTimer.current = null; }
				setOpen(true);
			};
			const closeSoon = () => {
				if (pinned) return;
				if (closeTimer.current !== null) clearTimeout(closeTimer.current);
				closeTimer.current = setTimeout(() => setOpen(false), LEAVE_CLOSE_MS);
			};

			if (turns.length === 0) return null;

			return h("div", {
				id: NAV_ID,
				ref: rootRef,
				className: `${open ? "ol-open " : ""}${dark ? "ol-dark" : ""}`.trim(),
				onMouseEnter: () => { if (closeTimer.current !== null) { clearTimeout(closeTimer.current); closeTimer.current = null; } },
				onMouseLeave: closeSoon,
			},
				h("div", {
					className: "ol-stack",
					title: "Outline (hover to expand, double-click to pin)",
					onClick: openNow,
					onDoubleClick: () => { setPinned((v) => !v); },
					onMouseEnter: () => {
						if (openTimer.current !== null) clearTimeout(openTimer.current);
						openTimer.current = setTimeout(() => setOpen(true), HOVER_OPEN_MS);
					},
					onMouseLeave: () => {
						if (openTimer.current !== null) { clearTimeout(openTimer.current); openTimer.current = null; }
					},
				},
					turns.map((t, i) => h("div", { key: t.key, className: `ol-dash${i === active ? " ol-on" : ""}` })),
				),
				h("div", { className: "ol-panel" },
					h("button", {
						className: "ol-close",
						title: "Close (double-click the dashes to pin)",
						onClick: (e) => { e.stopPropagation(); setPinned(false); setOpen(false); },
					}, "✕"),
					turns.map((t, i) => h("div", {
						key: t.key,
						className: `ol-row${i === active ? " ol-on" : ""}`,
						title: t.text,
						onClick: () => { jump(i); },
					},
						h("span", { className: "ol-num" }, String(i + 1)),
						h("span", { className: "ol-txt" }, t.text),
					)),
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
