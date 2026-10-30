# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Builds the CerebroKognit presentation (.pptx) in the product's own LIGHT theme.

Uses the real design tokens (porcelain surfaces, violet #6844FD / violet-dark
#4E28E0 / mint #58F6CA), the brand fonts (Plus Jakarta Sans + JetBrains Mono),
and the actual brand logo artwork. Flat design, no gradients-as-ornament.

Run:  backend/.venv/Scripts/python.exe presentation/build_presentation.py
Out:  presentation/CerebroKognit.pptx
"""
from pathlib import Path

from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt

ROOT = Path(__file__).resolve().parent.parent
LOGO_DIR = ROOT / "mobile" / "assets" / "logos"
OUT_DIR = ROOT / "presentation"
ASSET_DIR = OUT_DIR / "assets"
OUT = OUT_DIR / "CerebroKognit.pptx"

# --- brand tokens (light theme, mirror of mobile/src/theme/tokens.js) ---------
BG = RGBColor(0xF8, 0xFA, 0xFC)
SURFACE = RGBColor(0xFF, 0xFF, 0xFF)
TEXT = RGBColor(0x0F, 0x17, 0x2A)
MUTED = RGBColor(0x64, 0x74, 0x8B)
FAINT = RGBColor(0x94, 0xA3, 0xB8)
BORDER = RGBColor(0xE2, 0xE8, 0xF0)
VIOLET = RGBColor(0x68, 0x44, 0xFD)
VIOLET_DK = RGBColor(0x4E, 0x28, 0xE0)
MINT = RGBColor(0x58, 0xF6, 0xCA)
TINT = RGBColor(0xEE, 0xF1, 0xFF)

DISPLAY = "Plus Jakarta Sans"
MONO = "JetBrains Mono"

SW, SH = 13.333, 7.5  # 16:9 inches


def to_png(name):
    """Convert a logo webp to png once (python-pptx inserts png reliably)."""
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    dst = ASSET_DIR / (Path(name).stem + ".png")
    if not dst.exists():
        Image.open(LOGO_DIR / name).convert("RGBA").save(dst)
    return dst


def rect(slide, l, t, w, h, color, rounded=False, radius=None):
    shp = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE if rounded else MSO_SHAPE.RECTANGLE,
        Inches(l), Inches(t), Inches(w), Inches(h),
    )
    shp.fill.solid()
    shp.fill.fore_color.rgb = color
    shp.line.fill.background()
    shp.shadow.inherit = False
    if rounded and radius is not None:
        shp.adjustments[0] = radius
    return shp


def textbox(slide, l, t, w, h):
    tb = slide.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    return tf


def run(p, text, font, size, color, bold=False):
    r = p.add_run()
    r.text = text
    r.font.name = font
    r.font.size = Pt(size)
    r.font.color.rgb = color
    r.font.bold = bold
    return r


def background(slide):
    rect(slide, 0, 0, SW, SH, BG)
    rect(slide, 0, 0, SW, 0.11, VIOLET)  # brand top rule


def footer(slide, page):
    rect(slide, 0.9, 6.92, SW - 1.8, 0.012, BORDER)
    tf = textbox(slide, 0.9, 7.0, 9.0, 0.35)
    p = tf.paragraphs[0]
    run(p, "CerebroKognit  ·  Intelligent Cognitive Alarm Platform", MONO, 8.5, FAINT)
    tf2 = textbox(slide, SW - 1.9, 7.0, 1.0, 0.35)
    p2 = tf2.paragraphs[0]
    p2.alignment = PP_ALIGN.RIGHT
    run(p2, f"{page:02d}", MONO, 8.5, FAINT, bold=True)


# --- slide content ------------------------------------------------------------
# ('b', text) bullet · ('l', text) subsection label
SLIDES = [
    {
        "title": "The Core Problem",
        "label": "Why mornings fail",
        "items": [
            ("b", "Snooze addiction kills mornings"),
            ("b", "Groggy one-tap dismissals"),
            ("b", "Sleep inertia delays focus"),
            ("b", "Broken routines go unchecked"),
            ("b", "Oversleeping costs classes, work"),
            ("b", "No accountability after waking"),
            ("b", "Zero data on wake quality"),
        ],
    },
    {
        "title": "The Solution",
        "label": "Solve to wake",
        "items": [
            ("b", "Solve to dismiss alarms"),
            ("b", "Personalized cognitive challenges"),
            ("b", "Adaptive difficulty engine"),
            ("b", "Daily habit scoring"),
            ("b", "Train your brain awake"),
            ("b", "Evidence-based techniques"),
            ("b", "Offline-first, works anywhere"),
        ],
    },
    {
        "title": "Key Features",
        "label": "Capabilities",
        "items": [
            ("l", "Cognitive engine"),
            ("b", "7 challenge types"),
            ("b", "5 difficulty levels"),
            ("b", "Logic, math, memory, recall"),
            ("l", "Intelligence"),
            ("b", "Adaptive difficulty selection"),
            ("b", "Weighted habit score (35/25/20/20)"),
            ("b", "Personalized recommendations"),
            ("l", "Platform"),
            ("b", "Offline-first sync"),
            ("b", "Smart notifications"),
            ("b", "PDF/Excel reports"),
            ("b", "Web + mobile dashboards"),
        ],
    },
    {
        "title": "Tech Stack & Architecture",
        "label": "Built with",
        "items": [
            ("l", "Backend & Data"),
            ("b", "FastAPI, Python 3.11"),
            ("b", "PostgreSQL / SQLite"),
            ("b", "43+ REST endpoints"),
            ("l", "Clients"),
            ("b", "React 18 + Vite (web)"),
            ("b", "Expo SDK 58, React Native"),
            ("l", "Intelligence & Ops"),
            ("b", "AI: PyTorch + rules"),
            ("b", "Auth: JWT + Google OAuth2"),
            ("b", "Docker + GitHub Actions"),
        ],
    },
    {
        "title": "System Design / Workflow",
        "label": "How it flows",
        "kind": "diagram",
        "items": [
            ("b", "Mobile to FastAPI to PostgreSQL"),
            ("b", "JWT-protected API calls"),
            ("b", "Challenge gate pipeline"),
            ("b", "Dismiss to habit score update"),
            ("b", "Offline cache, idempotent sync"),
            ("b", "Web dashboard reads live data"),
            ("b", "Docker orchestrates all services"),
        ],
    },
    {
        "title": "Development Milestones",
        "label": "Build history",
        "items": [
            ("b", "M1 Foundation: complete"),
            ("b", "M2 Cognitive engine: complete"),
            ("b", "M3 Adaptive intelligence: complete"),
            ("b", "M4 Polish and deploy: complete"),
            ("b", "Phases A-D: OAuth2, AI, announcements"),
            ("b", "Retro-futuristic redesign landed"),
            ("b", "Docs, PRD and reports written"),
        ],
    },
    {
        "title": "Current Status & Demo",
        "label": "What works today",
        "items": [
            ("b", "Functional prototype, about 92%"),
            ("b", "384 automated tests passing"),
            ("b", "87% backend coverage"),
            ("b", "Auth and RBAC working"),
            ("b", "Alarm-dismiss E2E verified"),
            ("b", "Google OAuth2 live"),
            ("b", "Docker validated end-to-end"),
            ("b", "Real data only, no mocks"),
        ],
    },
    {
        "title": "Challenges Overcome",
        "label": "Hard problems",
        "items": [
            ("b", "Fixed challenge answer leak"),
            ("b", "Env-driven JWT secrets"),
            ("b", "Solved LAN connectivity"),
            ("b", "Fixed Python 3.14 crash"),
            ("b", "Built tests from zero"),
            ("b", "Repaired Docker entrypoint"),
            ("b", "Eliminated all mock data"),
        ],
    },
    {
        "title": "Future Roadmap",
        "label": "What is next",
        "items": [
            ("b", "Public cloud deployment"),
            ("b", "Real-device alarm E2E"),
            ("b", "Sentry monitoring"),
            ("b", "Higher mobile coverage"),
            ("b", "Bedtime alert triggers"),
            ("b", "Learned recommendation ranker"),
            ("b", "Scale to 1000+ users"),
        ],
    },
    {
        "title": "Practical Impact",
        "label": "Who it helps",
        "items": [
            ("l", "Personas"),
            ("b", "Students: consistent wake-ups"),
            ("b", "Professionals: productive mornings"),
            ("b", "Fitness: training adherence"),
            ("b", "Wellness partners: API integration"),
            ("l", "Outcomes"),
            ("b", "Fewer snoozes, better habits"),
            ("b", "Measurable, exportable insights"),
        ],
    },
]

CONTACT = [
    "Built by Pawan Simha R",
    "Guide: Shanmukha Priya",
    "iampawansimha.2004@gmail.com",
    "github.com/PawanSimha",
    "linkedin.com/in/pawansimha",
]


def title_slide(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    background(s)
    rect(s, 1.55, 1.15, 10.23, 5.2, SURFACE, rounded=True, radius=0.045)
    rect(s, 1.55, 1.15, 10.23, 0.09, VIOLET, rounded=False)

    logo = to_png("WideLight.webp")
    pic = s.shapes.add_picture(str(logo), Inches(4.55), Inches(1.75), width=Inches(4.2))
    pic.left = int((SW - pic.width / 914400) / 2 * 914400)

    tf = textbox(s, 1.9, 3.25, 9.53, 1.0)
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    run(p, "CerebroKognit", DISPLAY, 48, VIOLET_DK, bold=True)

    tf = textbox(s, 1.9, 4.28, 9.53, 0.6)
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    run(p, "Intelligent Cognitive Alarm Platform", DISPLAY, 22, TEXT, bold=True)

    tf = textbox(s, 1.9, 4.98, 9.53, 0.5)
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    run(p, "Wake with purpose.", DISPLAY, 17, MUTED)

    pill = rect(s, 4.97, 5.62, 3.4, 0.34, TINT, rounded=True, radius=0.5)
    pf = pill.text_frame
    pf.margin_left = pf.margin_right = 0
    pf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = pf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    run(p, "Infosys Virtual Internship 7.0", MONO, 10.5, VIOLET, bold=True)


def content_slide(prs, data, page):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    background(s)

    # title block
    rect(s, 0.9, 0.78, 0.09, 0.66, VIOLET)
    tf = textbox(s, 1.12, 0.72, 10.5, 0.8)
    p = tf.paragraphs[0]
    run(p, data["title"], DISPLAY, 30, TEXT, bold=True)

    # section label (mono sys-label, top right)
    tf = textbox(s, SW - 5.0, 0.86, 4.1, 0.4)
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.RIGHT
    run(p, data["label"].upper(), MONO, 10.5, VIOLET, bold=True)

    rect(s, 0.9, 1.62, SW - 1.8, 0.012, BORDER)

    # body
    tf = textbox(s, 1.12, 1.95, SW - 2.24, 4.8)
    first = True
    for kind, text in data["items"]:
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        if kind == "l":
            p.space_before = Pt(10)
            p.space_after = Pt(4)
            run(p, text.upper(), MONO, 12, VIOLET_DK, bold=True)
        else:
            p.space_after = Pt(9)
            run(p, "\u2022  ", DISPLAY, 18, VIOLET, bold=True)
            run(p, text, DISPLAY, 18, TEXT)

    footer(s, page)


def diagram_slide(prs, data, page):
    """3-tier architecture diagram: clients -> API -> data layer."""
    s = prs.slides.add_slide(prs.slide_layouts[6])
    background(s)

    rect(s, 0.9, 0.78, 0.09, 0.66, VIOLET)
    tf = textbox(s, 1.12, 0.72, 10.5, 0.8)
    run(tf.paragraphs[0], data["title"], DISPLAY, 30, TEXT, bold=True)
    tf = textbox(s, SW - 5.0, 0.86, 4.1, 0.4)
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.RIGHT
    run(p, data["label"].upper(), MONO, 10.5, VIOLET, bold=True)
    rect(s, 0.9, 1.62, SW - 1.8, 0.012, BORDER)

    def node(x, y, w, h, kicker, title, tone):
        box = rect(s, x, y, w, h, SURFACE, rounded=True, radius=0.09)
        box.line.color.rgb = BORDER
        box.line.width = Pt(1)
        rect(s, x, y, w, 0.07, tone)
        tf = textbox(s, x + 0.16, y + 0.16, w - 0.32, h - 0.3)
        p = tf.paragraphs[0]
        run(p, kicker.upper(), MONO, 9, tone, bold=True)
        p2 = tf.add_paragraph()
        p2.space_before = Pt(3)
        run(p2, title, DISPLAY, 15, TEXT, bold=True)
        return box

    def arrow_h(x1, x2, y):
        a = s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(x1), Inches(y), Inches(x2 - x1), Inches(0.22))
        a.fill.solid()
        a.fill.fore_color.rgb = VIOLET
        a.line.fill.background()
        a.shadow.inherit = False

    def arrow_d(x, y1, y2):
        a = s.shapes.add_shape(MSO_SHAPE.DOWN_ARROW, Inches(x), Inches(y1), Inches(0.22), Inches(y2 - y1))
        a.fill.solid()
        a.fill.fore_color.rgb = VIOLET
        a.line.fill.background()
        a.shadow.inherit = False

    # --- layer 1: clients -----------------------------------------------------
    node(1.20, 2.15, 2.7, 0.95, "client", "Expo Mobile App", VIOLET)
    node(4.30, 2.15, 2.7, 0.95, "client", "React Web App", VIOLET)

    # --- layer 2: API + AI ----------------------------------------------------
    node(1.20, 3.65, 5.8, 0.95, "api", "FastAPI + JWT + OAuth2", VIOLET_DK)
    node(7.60, 3.65, 2.6, 0.95, "ai", "AI Engine", VIOLET_DK)

    # --- layer 3: data --------------------------------------------------------
    node(1.20, 5.15, 2.7, 0.95, "data", "PostgreSQL", MINT)
    node(4.30, 5.15, 2.7, 0.95, "data", "Cache + Sync", MINT)

    # --- connectors (all straight, aligned to node centers) -------------------
    arrow_d(2.44, 3.10, 3.65)   # mobile -> api
    arrow_d(5.54, 3.10, 3.65)   # web    -> api
    arrow_h(7.00, 7.60, 4.05)   # ai     -> api
    arrow_d(2.44, 4.60, 5.15)   # api    -> postgres
    arrow_d(5.54, 4.60, 5.15)   # api    -> cache

    footer(s, page)


def closing_slide(prs, page):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    background(s)
    logo = to_png("JustLogo.webp")
    pic = s.shapes.add_picture(str(logo), Inches(0), Inches(1.1), height=Inches(1.15))
    pic.left = int((SW - pic.width / 914400) / 2 * 914400)

    tf = textbox(s, 1.9, 2.55, 9.53, 0.9)
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    run(p, "Thank You", DISPLAY, 44, VIOLET_DK, bold=True)

    tf = textbox(s, 1.9, 3.5, 9.53, 0.5)
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    run(p, "Questions welcome", DISPLAY, 18, MUTED)

    tf = textbox(s, 1.9, 4.35, 9.53, 2.0)
    for i, line in enumerate(CONTACT):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.CENTER
        p.space_after = Pt(6)
        mono = "@" in line or ".com" in line or "github" in line or "linkedin" in line
        run(p, line, MONO if mono else DISPLAY, 13, VIOLET if mono else TEXT, bold=not mono)
    footer(s, page)


def build():
    prs = Presentation()
    prs.slide_width = Inches(SW)
    prs.slide_height = Inches(SH)

    title_slide(prs)
    for i, data in enumerate(SLIDES, start=2):
        if data.get("kind") == "diagram":
            diagram_slide(prs, data, i)
        else:
            content_slide(prs, data, i)
    closing_slide(prs, len(SLIDES) + 2)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    prs.core_properties.title = "CerebroKognit - Intelligent Cognitive Alarm Platform"
    prs.core_properties.author = "Pawan Simha R"
    prs.core_properties.subject = "Infosys Virtual Internship 7.0"
    prs.save(str(OUT))
    print(f"Saved {OUT} ({len(prs.slides.__iter__.__self__._sldIdLst)} slides)")


if __name__ == "__main__":
    build()
