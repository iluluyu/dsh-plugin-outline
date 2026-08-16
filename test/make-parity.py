#!/usr/bin/env python3
"""Regenerate test/parity.html from the CSS constant inside lib/client.js.

Keeps the visual-parity fixture in lockstep with the shipped artifact: the
plugin's stylesheet is extracted at generation time, so the test page can
never drift from lib/client.js. Run from the repo root:

    python3 test/make-parity.py
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "lib" / "client.js"
OUT = ROOT / "test" / "parity.html"
NAV_ID = "dsh-outline-root"

css = re.search(r"const CSS = `\n(.*?)\t\t`;", SRC.read_text(encoding="utf-8"), re.S)
assert css, "CSS constant not found in lib/client.js"
CSS = css.group(1)
for k, v in [("${NAV_ID}", NAV_ID), ("${ROW_H}", "30"), ("${PAD_V}", "15")]:
    CSS = CSS.replace(k, v)
assert "${" not in CSS, "unresolved template placeholder in CSS"


def rail(state: str, theme: str, n: int = 7) -> str:
    rows = "".join(
        f'<div class="ol-row{" ol-on" if i == 2 else ""}" title="t">'
        f'<span class="ol-txt">解释一下 pretty 这个词在不同语境下的含义 {i + 1}</span>'
        f'<span class="ol-dot"></span></div>'
        for i in range(n)
    )
    cls = f"{state} {theme}".strip()
    return (
        f'<div id="{NAV_ID}" class="{cls}" style="position:relative;top:0;right:0;'
        f'transform:none;height:300px">'
        f'<div class="ol-pill"></div>'
        f'<div class="ol-panel"><div class="ol-list">{rows}</div></div></div>'
    )


html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>outline UI parity</title>
<style>
body {{ margin:0; font-family: sans-serif; }}
.stage {{ display:flex; gap:40px; padding:40px; align-items:flex-start; flex-wrap:wrap; }}
.card {{ padding:20px; border-radius:16px; }}
.light-stage {{ background:#e9ecf2; }}
.dark-stage {{ background:#151517; }}
h2 {{ font-size:13px; margin:0 0 12px; }}
.light-stage h2 {{ color:#61666b; }}
.dark-stage h2 {{ color:#adb2b8; }}
</style>
<style id="plugin-css">
{CSS}
</style></head><body>
<div class="stage">
  <div class="card light-stage"><h2>light · collapsed</h2>{rail("", "")}</div>
  <div class="card light-stage"><h2>light · open</h2>{rail("ol-open", "")}</div>
  <div class="card dark-stage"><h2>dark · collapsed</h2>{rail("", "ol-dark")}</div>
  <div class="card dark-stage"><h2>dark · open</h2>{rail("ol-open", "ol-dark")}</div>
</div></body></html>
"""

OUT.write_text(html, encoding="utf-8")
print(f"wrote {OUT} ({len(html)} bytes)")
