"""Generate themed SVG covers for projects without their own image, and
animated illustrations for the research cards.

Run from the portfolio folder:  python tools/make_covers.py
"""

from __future__ import annotations

import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "assets"
W, H = 800, 450
EMBER, GOLD, BLUE, GREEN, INK, MUTED = "#ff7a45", "#ffb547", "#5aa9ff", "#3ddc97", "#e7ecf5", "#8a97b0"


def frame(body: str, accent: str = EMBER, extra_defs: str = "", style: str = "") -> str:
    grid = "".join(f'<path d="M{x} 0V{H}" />' for x in range(0, W, 40)) + "".join(
        f'<path d="M0 {y}H{W}" />' for y in range(0, H, 40)
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1020"/><stop offset="1" stop-color="#1a2444"/></linearGradient>
  <radialGradient id="glow" cx="0.75" cy="0.2" r="0.7"><stop offset="0" stop-color="{accent}" stop-opacity="0.35"/><stop offset="1" stop-color="{accent}" stop-opacity="0"/></radialGradient>
  <linearGradient id="ember" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{EMBER}"/><stop offset="1" stop-color="{GOLD}"/></linearGradient>
  {extra_defs}
</defs>
<style>text{{font-family:'JetBrains Mono',ui-monospace,Consolas,monospace}}{style}</style>
<rect width="{W}" height="{H}" fill="url(#bg)"/>
<g stroke="#ffffff" stroke-opacity="0.04" stroke-width="1">{grid}</g>
<rect width="{W}" height="{H}" fill="url(#glow)"/>
{body}
</svg>"""


def card(x, y, w, h, fill="#151d33", stroke="#ffffff", so=0.12, r=12):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-opacity="{so}"/>'


def lines(x, y, widths, color=MUTED, gap=16, h=6):
    return "".join(f'<rect x="{x}" y="{y + i * gap}" width="{w}" height="{h}" rx="3" fill="{color}" opacity="0.55"/>' for i, w in enumerate(widths))


def label(x, y, text, color=INK, size=15, anchor="start", weight=600):
    return f'<text x="{x}" y="{y}" fill="{color}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}">{text}</text>'


def pill(x, y, text, color=EMBER, w=None):
    w = w or 16 + len(text) * 8.6
    return f'<rect x="{x}" y="{y}" width="{w}" height="26" rx="13" fill="{color}" fill-opacity="0.16" stroke="{color}" stroke-opacity="0.6"/>' + label(
        x + w / 2, y + 18, text, color, 13, "middle"
    )


def polyline(points, color, width=3, dash=""):
    d = " ".join(f"{x:.1f},{y:.1f}" for x, y in points)
    da = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<polyline points="{d}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"{da}/>'


# ---------------------------------------------------------------- project covers
def rag_chatbot():
    b = ""
    # document stack -> retriever -> chat
    for i in range(3):
        b += card(70 + i * 12, 120 - i * 12, 150, 190, so=0.18) + lines(88 + i * 12, 150 - i * 12, [110, 90, 100, 70, 95, 60])
    b += f'<path d="M250 215H330" stroke="url(#ember)" stroke-width="3" stroke-dasharray="6 6"/><circle cx="370" cy="215" r="34" fill="#151d33" stroke="{EMBER}" stroke-width="2"/>'
    b += f'<circle cx="364" cy="209" r="13" fill="none" stroke="{GOLD}" stroke-width="3"/><path d="M374 219l12 12" stroke="{GOLD}" stroke-width="3" stroke-linecap="round"/>'
    b += '<path d="M410 215H470" stroke="url(#ember)" stroke-width="3" stroke-dasharray="6 6"/>'
    b += card(480, 95, 250, 70, fill="#1b2542") + lines(500, 118, [190, 130]) + card(520, 185, 210, 100, fill=EMBER, so=0, r=14)
    b += lines(540, 208, [160, 170, 110], color="#ffffff") + pill(540, 252, "[1]", "#ffffff", 40) + pill(588, 252, "[2]", "#ffffff", 40)
    b += card(480, 305, 180, 50, fill="#1b2542") + lines(500, 322, [120, 80], gap=14)
    b += label(70, 400, "retrieve · ground · cite", MUTED, 16)
    return frame(b)


def ticket_triage():
    b = ""
    for i, (y, w) in enumerate([(90, [150, 110]), (170, [130, 150]), (250, [160, 90]), (330, [120, 140])]):
        b += card(60, y, 210, 62, so=0.16) + lines(78, y + 20, w, gap=15)
        b += f'<path d="M270 {y + 31}C330 {y + 31} 330 225 372 225" stroke="{MUTED}" stroke-opacity="0.5" stroke-width="2" fill="none"/>'
    b += f'<rect x="372" y="180" width="90" height="90" rx="18" fill="#151d33" stroke="{EMBER}" stroke-width="2"/>' + label(417, 222, "{ }", GOLD, 30, "middle") + label(417, 250, "schema", MUTED, 12, "middle")
    for (y, t, c) in [(96, "billing · high", EMBER), (166, "shipping · medium", BLUE), (236, "account · urgent", "#ff5f7a"), (306, "feature · low", GREEN)]:
        b += f'<path d="M462 225C510 225 510 {y + 13} 548 {y + 13}" stroke="{c}" stroke-opacity="0.7" stroke-width="2" fill="none"/>' + pill(548, y, t, c, 190)
    b += label(548, 386, "accuracy gate ✓", GREEN, 15)
    return frame(b, accent=BLUE)


def price_tracker():
    random.seed(7)
    b = ""
    series = [(EMBER, 250), (BLUE, 215), (GREEN, 280)]
    for color, base in series:
        pts, y = [], base
        for i in range(15):
            y += random.uniform(-16, 14)
            pts.append((80 + i * 36, max(110, min(330, y))))
        b += polyline(pts, color) + f'<circle cx="{pts[-1][0]}" cy="{pts[-1][1]}" r="6" fill="{color}"/>'
    b += f'<path d="M80 345H620M80 345V95" stroke="{MUTED}" stroke-opacity="0.5" stroke-width="2"/>'
    b += pill(640, 110, "Amazon DE", EMBER, 120) + pill(640, 150, "eBay DE", BLUE, 120) + pill(640, 190, "Idealo DE", GREEN, 120)
    b += card(640, 250, 120, 90, fill="#151d33") + label(700, 285, "F1", MUTED, 13, "middle") + label(700, 318, "0.911", GOLD, 26, "middle")
    b += label(80, 400, "scrape · match · unify", MUTED, 16)
    return frame(b)


def genai_notebooks():
    b = card(110, 80, 260, 290, so=0.18)
    for i, (c, w) in enumerate([(BLUE, [180, 140]), (GREEN, [150, 190]), (GOLD, [170, 120])]):
        y = 110 + i * 85
        b += f'<rect x="130" y="{y}" width="6" height="56" rx="3" fill="{c}"/>' + lines(150, y + 6, w + [100], gap=18)
    b += '<path d="M370 225H450" stroke="url(#ember)" stroke-width="3" stroke-dasharray="6 6"/>'
    cx, cy = 560, 225
    b += f'<circle cx="{cx}" cy="{cy}" r="92" fill="{EMBER}" fill-opacity="0.08" stroke="{EMBER}" stroke-opacity="0.4"/>'
    b += f'<path d="M{cx} {cy - 70}C{cx + 10} {cy - 14} {cx + 14} {cy - 10} {cx + 70} {cy}C{cx + 14} {cy + 10} {cx + 10} {cy + 14} {cx} {cy + 70}C{cx - 10} {cy + 14} {cx - 14} {cy + 10} {cx - 70} {cy}C{cx - 14} {cy - 10} {cx - 10} {cy - 14} {cx} {cy - 70}Z" fill="url(#ember)"/>'
    b += f'<circle cx="{cx + 78}" cy="{cy - 78}" r="7" fill="{GOLD}"/><circle cx="{cx - 84}" cy="{cy + 66}" r="5" fill="{BLUE}"/>'
    b += label(110, 410, "LLM calls · vector DBs · apps", MUTED, 16)
    return frame(b)


def hawaii():
    b = f'<path d="M90 300C150 220 230 190 300 215C350 160 450 150 520 205C590 190 680 240 720 310C600 345 220 350 90 300Z" fill="{GREEN}" fill-opacity="0.14" stroke="{GREEN}" stroke-opacity="0.6" stroke-width="2"/>'
    random.seed(3)
    for _ in range(26):
        x, y, r = random.uniform(150, 660), random.uniform(205, 310), random.uniform(4, 13)
        b += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.0f}" fill="{random.choice([EMBER, GOLD, BLUE])}" fill-opacity="0.75"/>'
    for x, y in [(300, 215), (520, 205)]:
        b += f'<path d="M{x} {y}c-16 -22 -22 -32 -22 -44a22 22 0 1 1 44 0c0 12 -6 22 -22 44Z" fill="{EMBER}"/><circle cx="{x}" cy="{y - 44}" r="8" fill="#0b1020"/>'
    b += f'<path d="M0 380Q200 360 400 380T800 380V450H0Z" fill="{BLUE}" fill-opacity="0.12"/>'
    b += label(90, 100, "price · location · demand", MUTED, 16)
    return frame(b, accent=GREEN)


def electricity():
    pts = [(70 + i * 30, 240 + 60 * math.sin(i / 2.2) + 22 * math.sin(i * 1.3)) for i in range(16)]
    fc = [(pts[-1][0] + i * 30, pts[-1][1] - 12 * i + 26 * math.sin(i)) for i in range(7)]
    band = " ".join(f"{x:.0f},{y - 14 - i * 5:.0f}" for i, (x, y) in enumerate(fc)) + " " + " ".join(f"{x:.0f},{y + 14 + i * 5:.0f}" for i, (x, y) in reversed(list(enumerate(fc))))
    b = f'<polygon points="{band}" fill="{GOLD}" fill-opacity="0.15"/>' + polyline(pts, BLUE) + polyline(fc, GOLD, 3, "8 6")
    b += f'<path d="M70 360H730M70 360V90" stroke="{MUTED}" stroke-opacity="0.5" stroke-width="2"/><path d="M{pts[-1][0]} 90V360" stroke="{MUTED}" stroke-dasharray="4 6"/>'
    b += f'<path d="M640 70l-46 78h36l-16 62 56-86h-38z" fill="url(#ember)"/>'
    b += label(70, 410, "history", BLUE, 15) + label(540, 410, "forecast", GOLD, 15)
    return frame(b, accent=GOLD)


def spam():
    b = ""
    for i, (x, y, bad) in enumerate([(80, 90, False), (80, 200, True), (80, 310, False), (300, 145, True), (300, 255, False)]):
        c = "#ff5f7a" if bad else GREEN
        b += card(x, y, 170, 84, so=0.16) + f'<path d="M{x} {y + 10}l85 42 85-42" fill="none" stroke="{c}" stroke-width="2.5"/>'
        b += f'<circle cx="{x + 150}" cy="{y + 12}" r="13" fill="{c}"/>' + label(x + 150, y + 17, "!" if bad else "✓", "#0b1020", 15, "middle", 800)
    b += f'<path d="M620 95l90 34v66c0 62-38 104-90 126c-52-22-90-64-90-126v-66z" fill="{BLUE}" fill-opacity="0.12" stroke="{BLUE}" stroke-width="3"/>'
    b += f'<path d="M580 208l28 28 54-58" fill="none" stroke="{GREEN}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>'
    b += '<path d="M480 225H520" stroke="url(#ember)" stroke-width="3" stroke-dasharray="6 6"/>'
    return frame(b, accent=BLUE)


def pedata():
    b = ""
    for i in range(13):
        x = 90 + i * 50
        y1, y2 = 225 + 80 * math.sin(i / 1.7), 225 - 80 * math.sin(i / 1.7)
        b += f'<path d="M{x} {y1:.0f}V{y2:.0f}" stroke="{MUTED}" stroke-opacity="0.45" stroke-width="2"/>'
        b += f'<circle cx="{x}" cy="{y1:.0f}" r="11" fill="{[EMBER, GOLD, BLUE, GREEN][i % 4]}"/><circle cx="{x}" cy="{y2:.0f}" r="11" fill="{[BLUE, GREEN, EMBER, GOLD][i % 4]}"/>'
    b += label(90, 90, "M K T A Y I A K Q R …", GOLD, 20) + label(90, 400, "datasets for protein engineering", MUTED, 16)
    return frame(b, accent=GREEN)


def condition_pipeline():
    b = ""
    nodes = [(110, "process"), (270, "train"), (430, "evaluate")]
    for x, t in nodes:
        b += card(x - 60, 190, 120, 60, so=0.2) + label(x, 226, t, INK, 15, "middle")
    b += "".join(f'<path d="M{x + 60} 220H{x + 100}" stroke="url(#ember)" stroke-width="3"/>' for x, _ in nodes)
    b += f'<path d="M580 165l55 55-55 55-55-55z" fill="#151d33" stroke="{GOLD}" stroke-width="2.5"/>' + label(580, 226, "AUC?", GOLD, 15, "middle")
    b += f'<path d="M620 205C670 160 670 130 690 120" stroke="{GREEN}" stroke-width="3" fill="none"/>' + pill(640, 92, "register ✓", GREEN, 120)
    b += f'<path d="M620 235C670 280 670 310 690 320" stroke="#ff5f7a" stroke-width="3" fill="none"/>' + pill(640, 322, "stop ✕", "#ff5f7a", 120)
    b += label(50, 400, "SageMaker condition step", MUTED, 16)
    return frame(b, accent=GOLD)


# ---------------------------------------------------------------- research illustrations
def research_grafiti():
    """Irregularly sampled channels -> bipartite graph -> forecast."""
    random.seed(11)
    style = "@keyframes pulse{0%,100%{opacity:.25}50%{opacity:1}}@keyframes dash{to{stroke-dashoffset:-24}}.e{stroke-dasharray:5 7;animation:dash 1.6s linear infinite}.p{animation:pulse 2.4s ease-in-out infinite}"
    b = ""
    chan_y = [120, 200, 280, 360]
    colors = [EMBER, BLUE, GREEN, GOLD]
    obs = []
    for cy, c in zip(chan_y, colors):
        b += f'<path d="M60 {cy}H330" stroke="{MUTED}" stroke-opacity="0.35" stroke-width="1.5"/>'
        xs = sorted(random.sample(range(75, 320, 14), random.randint(4, 7)))
        for x in xs:
            y = cy + random.uniform(-22, 22)
            obs.append((x, y, c))
            b += f'<path d="M{x} {cy}V{y:.0f}" stroke="{c}" stroke-opacity="0.5"/><circle cx="{x}" cy="{y:.0f}" r="5.5" fill="{c}"/>'
    b += label(60, 70, "asynchronous observations", MUTED, 14)
    # graph nodes
    tnodes = [(450, 110 + i * 46) for i in range(6)]
    cnodes = [(600, y) for y in chan_y]
    for i, (x, y, c) in enumerate(obs):
        tx, ty = tnodes[i % len(tnodes)]
        ci = colors.index(c)
        b += f'<path class="e" d="M{tx} {ty}L{cnodes[ci][0]} {cnodes[ci][1]}" stroke="{c}" stroke-opacity="0.55" stroke-width="1.6" style="animation-delay:-{i * 0.13:.2f}s"/>'
    for x, y in tnodes:
        b += f'<circle cx="{x}" cy="{y}" r="9" fill="#151d33" stroke="{INK}" stroke-opacity="0.7" stroke-width="2"/>'
    for (x, y), c in zip(cnodes, colors):
        b += f'<circle cx="{x}" cy="{y}" r="13" fill="{c}"/>'
    b += label(450, 70, "time", MUTED, 14, "middle") + label(600, 70, "channel", MUTED, 14, "middle")
    b += '<path d="M345 240H420" stroke="url(#ember)" stroke-width="3" stroke-dasharray="6 6"/>'
    # forecast queries
    for i, ((x, y), c) in enumerate(zip(cnodes, colors)):
        b += f'<path d="M{x + 13} {y}H700" stroke="{c}" stroke-opacity="0.6" stroke-width="2" stroke-dasharray="3 5"/>'
        b += f'<circle class="p" cx="722" cy="{y}" r="11" fill="none" stroke="{c}" stroke-width="3" style="animation-delay:-{i * 0.5}s"/><circle cx="722" cy="{y}" r="4" fill="{c}"/>'
    b += label(722, 70, "forecast", MUTED, 14, "middle")
    return frame(b, accent=BLUE, style=style)


def research_hbb():
    """Data usage climbing toward the quota with a 7-day prediction window."""
    style = "@keyframes draw{from{stroke-dashoffset:900}to{stroke-dashoffset:0}}@keyframes blink{0%,100%{opacity:.35}50%{opacity:1}}.d{stroke-dasharray:900;animation:draw 3.5s ease-out infinite alternate}.b{animation:blink 1.4s ease-in-out infinite}"
    x0, x1, yb, yq = 90, 720, 360, 120
    hist = [(x0 + i * 30, yb - 8 - i * 7.5 - 9 * math.sin(i / 1.6)) for i in range(13)]
    fc = [(hist[-1][0] + i * 30, hist[-1][1] - i * (hist[-1][1] - yq) / 6.2) for i in range(8)]
    b = f'<path d="M{x0} {yb}H{x1}M{x0} {yb}V80" stroke="{MUTED}" stroke-opacity="0.5" stroke-width="2"/>'
    b += f'<path d="M{x0} {yq}H{x1}" stroke="#ff5f7a" stroke-width="2" stroke-dasharray="8 6"/>' + label(x1, yq - 10, "data quota", "#ff5f7a", 14, "end")
    wx = hist[-1][0]
    b += f'<rect x="{wx}" y="80" width="{fc[-1][0] - wx}" height="{yb - 80}" fill="{GOLD}" fill-opacity="0.08"/>' + label(wx + (fc[-1][0] - wx) / 2, 100, "7-day window", GOLD, 14, "middle")
    area = " ".join(f"{x:.0f},{y:.0f}" for x, y in hist) + f" {hist[-1][0]:.0f},{yb} {x0},{yb}"
    b += f'<polygon points="{area}" fill="{BLUE}" fill-opacity="0.12"/>' + polyline(hist, BLUE, 3.5)
    d = " ".join(f"{x:.0f},{y:.0f}" for x, y in fc)
    b += f'<polyline class="d" points="{d}" fill="none" stroke="{GOLD}" stroke-width="3.5" stroke-linecap="round"/>'
    hx, hy = next((x, y) for x, y in fc if y <= yq + 6)
    b += f'<circle class="b" cx="{hx:.0f}" cy="{yq}" r="16" fill="#ff5f7a" fill-opacity="0.25"/><circle cx="{hx:.0f}" cy="{yq}" r="7" fill="#ff5f7a"/>'
    b += label(x0, 410, "usage so far", BLUE, 14) + label(wx + 10, 410, "predicted exhaustion → proactive offer", GOLD, 14)
    # router icon
    b += f'<rect x="120" y="96" width="92" height="34" rx="8" fill="#151d33" stroke="{INK}" stroke-opacity="0.5"/><circle cx="140" cy="113" r="4" fill="{GREEN}"/><circle cx="156" cy="113" r="4" fill="{GREEN}"/><circle cx="172" cy="113" r="4" fill="{GOLD}"/>'
    b += f'<path d="M150 88a22 22 0 0 1 32 0M142 78a34 34 0 0 1 48 0" fill="none" stroke="{BLUE}" stroke-width="3" stroke-linecap="round"/>'
    return frame(b, accent=GOLD, style=style)


def main() -> None:
    (OUT / "projects").mkdir(parents=True, exist_ok=True)
    (OUT / "research").mkdir(parents=True, exist_ok=True)
    covers = {
        "projects/rag-chatbot.svg": rag_chatbot,
        "projects/ticket-triage.svg": ticket_triage,
        "projects/price-tracker.svg": price_tracker,
        "projects/genai-foundations.svg": genai_notebooks,
        "projects/hawaii.svg": hawaii,
        "projects/electricity.svg": electricity,
        "projects/spam.svg": spam,
        "projects/pedata.svg": pedata,
        "projects/condition-step.svg": condition_pipeline,
        "research/grafiti.svg": research_grafiti,
        "research/hbb.svg": research_hbb,
    }
    for name, fn in covers.items():
        (OUT / name).write_text(fn(), encoding="utf-8")
        print("wrote", name)


if __name__ == "__main__":
    main()
