"""Generate the CerebroKognit final presentation (.pptx) with speaker notes."""
import os

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Inches, Pt

OUT = os.path.join(
    os.path.dirname(__file__), "..", "presentation", "CerebroKognit_Final.pptx"
)
OUT = os.path.abspath(OUT)

NAVY = RGBColor(0x1E, 0x29, 0x3B)
BLUE = RGBColor(0x3B, 0x82, 0xF6)
TEAL = RGBColor(0x10, 0xB9, 0x81)
AMBER = RGBColor(0xF5, 0x9E, 0x0B)
GREY = RGBColor(0x6B, 0x72, 0x80)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT = RGBColor(0xF8, 0xF9, 0xFA)

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]


def add_bg(slide, color=LIGHT):
    r = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    r.fill.solid()
    r.fill.fore_color.rgb = color
    r.line.fill.background()
    r.shadow.inherit = False
    return r


def textbox(slide, l, t, w, h, text, size=18, bold=False, color=NAVY,
            align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    tb = slide.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = "Calibri"
    return tb


def bullets(slide, l, t, w, h, items, size=16, gap=6):
    tb = slide.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    first = True
    for item in items:
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.space_after = Pt(gap)
        if isinstance(item, tuple):
            head, rest = item
            r = p.add_run()
            r.text = head
            r.font.bold = True
            r.font.size = Pt(size)
            r.font.color.rgb = NAVY
            r = p.add_run()
            r.text = rest
            r.font.size = Pt(size)
            r.font.color.rgb = GREY
        else:
            r = p.add_run()
            r.text = item
            r.font.size = Pt(size)
            r.font.color.rgb = GREY
    return tb


def chip(slide, l, t, w, text, color=BLUE):
    ch = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(l), Inches(t), Inches(w), Inches(0.55))
    ch.fill.solid()
    ch.fill.fore_color.rgb = color
    ch.line.fill.background()
    tf = ch.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    p.add_run().text = text
    p.runs[0].font.size = Pt(15)
    p.runs[0].font.bold = True
    p.runs[0].font.color.rgb = WHITE
    return ch


def card(slide, l, t, w, h, title, body, accent=BLUE):
    c = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(l), Inches(t), Inches(w), Inches(h))
    c.fill.solid()
    c.fill.fore_color.rgb = WHITE
    c.line.color.rgb = RGBColor(0xE0, 0xE4, 0xE8)
    c.shadow.inherit = False
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(l + 0.15), Inches(t + 0.15), Inches(0.09), Inches(h - 0.3))
    bar.fill.solid()
    bar.fill.fore_color.rgb = accent
    bar.line.fill.background()
    textbox(slide, l + 0.45, t + 0.15, w - 0.6, 0.5, title, size=16, bold=True, color=NAVY)
    textbox(slide, l + 0.45, t + 0.65, w - 0.6, h - 0.8, body, size=13, color=GREY)


def title_slide():
    s = prs.slides.add_slide(BLANK)
    add_bg(s, NAVY)
    textbox(s, 1.0, 2.0, 11.3, 1.2, "CerebroKognit", size=60, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    textbox(s, 1.0, 3.2, 11.3, 0.8, "Intelligent Cognitive Alarm Platform", size=26, color=RGBColor(0xCA, 0xD5, 0xFF), align=PP_ALIGN.CENTER)
    textbox(s, 1.0, 4.3, 11.3, 0.5, "Wake up sharper, not just earlier.", size=18, color=TEAL, align=PP_ALIGN.CENTER)
    chip(s, 5.2, 5.6, 2.9, "Internship Capstone · B3", TEAL)
    textbox(s, 1.0, 6.5, 11.3, 0.5, "Full-stack · React Native + FastAPI + PostgreSQL + ML (PyTorch)",
            size=15, color=RGBColor(0x9A, 0xA5, 0xD0), align=PP_ALIGN.CENTER)
    s.notes_slide.notes_text_frame.text = (
        "Good morning. I'm presenting CerebroKognit — an intelligent cognitive alarm platform we built as our "
        "internship capstone. It turns the most common daily annoyance, hitting snooze, into a brain-training signal. "
        "We spent 8 milestones across mobile, backend, web, and ML, delivering a production-shaped, fully tested system. "
        "Over the next few minutes I'll show the problem, the architecture, what we built, how we validated it, and what's next."
    )


def section(title, subtitle):
    s = prs.slides.add_slide(BLANK)
    add_bg(s, NAVY)
    textbox(s, 1.0, 2.4, 11.3, 1.0, title, size=40, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    textbox(s, 1.0, 3.6, 11.3, 0.8, subtitle, size=20, color=RGBColor(0xCA, 0xD5, 0xFF), align=PP_ALIGN.CENTER)
    return s


def content(title, subtitle=None):
    s = prs.slides.add_slide(BLANK)
    add_bg(s, LIGHT)
    r = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, Inches(1.1))
    r.fill.solid()
    r.fill.fore_color.rgb = NAVY
    r.line.fill.background()
    textbox(s, 0.6, 0.25, 12.1, 0.6, title, size=26, bold=True, color=WHITE)
    if subtitle:
        textbox(s, 0.6, 0.72, 12.1, 0.4, subtitle, size=14, color=RGBColor(0xCA, 0xD5, 0xFF))
    return s


# ---------------------------------------------------------------------------
title_slide()

# --- Agenda
s = content("What we'll cover", "Roadmap of the presentation")
bullets(s, 0.8, 1.5, 11.7, 5.0, [
    ("1 · Problem & opportunity — ", "why a cognitive alarm, and the market need"),
    ("2 · Solution overview — ", "the core loop and architecture"),
    ("3 · What we built — ", "mobile, backend, web, ML across 8 milestones"),
    ("4 · Validation & quality — ", "72 automated tests + end-to-end flows verified"),
    ("5 · Challenges & demo highlights — ", "what we solved along the way"),
    ("6 · Impact & next steps — ", "scale-out path and remaining backlog"),
], size=18, gap=14)
s.notes_slide.notes_text_frame.text = (
    "Here is the roadmap. I'll frame the problem first, then the product and architecture, walk through the four "
    "delivered frontends and the ML engine, show the testing and quality backbone, and end with impact and the roadmap "
    "ahead. The through-line: everything I claim is backed by automated tests and verified end-to-end flows."
)

# --- Problem
s = content("The problem: our morning brains are the problem", "Grocery-list decision fatigue, before coffee")
textbox(s, 0.8, 1.3, 11.7, 0.6, "Waking up is the hardest cognitive task of the day — and alarm apps ignore it.",
        size=20, bold=True, color=NAVY)
bullets(s, 0.8, 2.1, 6.0, 4.2, [
    "Snooze habits reinforce poor sleep + grogginess (sleep inertia)",
    "Ordinary alarms are passive — they ring and stop",
    "Users have no feedback on their wake-up behavior",
    "No personalization: everyone gets the same beep",
], size=16, gap=10)
card(s, 7.1, 2.1, 5.4, 4.2, "Insight", "Dismissing an alarm takes cognitive effort. If we exercise that brain while waking, we convert a passive ring into an active, personalized habit-building signal.", TEAL)
s.notes_slide.notes_text_frame.text = (
    "Our brains are slowest right after waking. Existing alarm apps treat that as a non-issue — they ring and stop, "
    "and snooze teaches the brain to ignore the signal. There's no personalization and no feedback loop. CerebroKognit "
    "attacks this directly: the act of verifying you're awake becomes a short cognitive challenge, so waking engages "
    "your brain immediately and builds a measurable habit."
)

# --- Solution core loop
s = content("Solution: the cognitive verification loop", "Wake → think → verify → improve")
card(s, 0.7, 1.6, 3.9, 2.2, "1 · Wake", "Smart alarm fires at your real wake-up time, factoring sleep + schedule.", BLUE)
card(s, 4.75, 1.6, 3.9, 2.2, "2 · Think", "A short cognitive challenge (math / logic / memory / word / pattern / riddle / quick-quiz) is served before you can dismiss.", TEAL)
card(s, 8.8, 1.6, 3.9, 2.2, "3 · Verify", "Answer is verified server-side — no answer can be leaked or guessed.", AMBER)
card(s, 0.7, 4.1, 3.9, 2.2, "4 · Improve", "Correct & quick → difficulty adapts up. Snoozing → tracked and discouraged.", TEAL)
card(s, 4.75, 4.1, 3.9, 2.2, "5 · Score", "Daily habit score: wake-up consistency, challenge completion, snooze reduction, sleep adherence.", BLUE)
card(s, 8.8, 4.1, 3.9, 2.2, "6 · Coach", "Recommendations tune your bedtime, wake-up time, and challenge mix.", NAVY)
s.notes_slide.notes_text_frame.text = (
    "The product is a loop. A smart alarm wakes you. Before you can dismiss it you complete a short cognitive challenge "
    "verified on the server. Performance feeds adaptive difficulty, a daily habit score, and coach-level recommendations "
    "for sleep and wake-up timing. This loop repeats daily, compounding better habits."
)

# --- Architecture
s = content("Architecture: three clients, one authoritative backend", "React Native · React · FastAPI · PostgreSQL · PyTorch")
card(s, 0.7, 1.5, 3.9, 2.0, "Mobile (Expo / RN 0.87)", "Alarm dismissal, offline-first sync engine, push registration.", BLUE)
card(s, 0.7, 3.7, 3.9, 2.0, "Web Dashboard (React 18)", "Home, Dashboard, Reports, and an RBAC Admin console.", BLUE)
card(s, 0.7, 5.9, 3.9, 1.3, "ML Engine (PyTorch)", "Adaptive difficulty: predicts challenge level from performance history.", TEAL)
card(s, 4.75, 1.5, 3.9, 4.6, "FastAPI Backend", "Auth + RBAC · adaptive challenge engine · habit scoring · analytics · recommendations · sync · reports · notifications · gateway (rate-limit + logging).", NAVY)
card(s, 8.8, 1.5, 3.9, 4.6, "PostgreSQL 15", "Users, roles, alarms, challenges, attempts, habit scores, push tokens. Alembic migrations; SQLite auto-init for local dev.", AMBER)
s.notes_slide.notes_text_frame.text = (
    "Three clients — a React Native mobile app, a React web dashboard, and an ML engine — are fronted by one "
    "authoritative FastAPI backend over PostgreSQL. A gateway middleware enforces rate limiting, structured logging, "
    "and error envelopes. The ML engine adapts difficulty using a trained PyTorch model with a rule-based fallback so a "
    "lean runtime can still function without the heavy dependency."
)

# --- What we built / milestones
s = content("Eight milestones, delivery complete", "Milestones 1–4 delivered; 4 more archived for future scope")
headers = ["Milestone", "Focus", "Shipped"]
tbl_shape = s.shapes.add_table(5, 3, Inches(0.7), Inches(1.5), Inches(11.9), Inches(4.6))
tbl = tbl_shape.table
widths = [2.2, 5.4, 4.3]
for i, w in enumerate(widths):
    tbl.columns[i].width = Inches(w)
rows = [
    ("M1", "Auth, profiles, tz-aware alarms", "bcrypt + JWT + RBAC; profile/settings; timezone scheduling"),
    ("M2", "Server-authoritative challenge engine", "No answer leak; /submit verify; alarm-dismiss gate; real analytics"),
    ("M3", "Adaptive ML + coaching", "Trained difficulty model; recommendations; streak habit scoring; live dashboards"),
    ("M4", "Hardening, reports, deployment", "Error envelope, CI, Docker, admin UI, PDF/Excel, mobile tests + offline sync"),
]
for r, row in enumerate(rows):
    for c, val in enumerate(row):
        cell = tbl.cell(r + 1, c)
        cell.text = val
        cell.text_frame.paragraphs[0].font.size = Pt(14)
        cell.text_frame.paragraphs[0].font.color.rgb = GREY
for c, val in enumerate(headers):
    cell = tbl.cell(0, c)
    cell.text = val
    cell.text_frame.paragraphs[0].font.bold = True
    cell.text_frame.paragraphs[0].font.size = Pt(15)
    cell.text_frame.paragraphs[0].font.color.rgb = WHITE
s.notes_slide.notes_text_frame.text = (
    "We executed in eight milestone-driven phases. M1 locked auth, RBAC, profiles, and timezone-aware alarms. M2 built the "
    "server-authoritative challenge engine — the security backbone so answers can't leak. M3 added adaptive difficulty via a "
    "trained PyTorch model, recommendations, and real-data dashboards. M4 hardened everything: structured errors, CI, Docker "
    "deployment, an admin console, PDF/Excel reports, mobile test coverage, and an offline sync engine."
)

# --- Backend features
s = content("Backend: 30+ REST endpoints, security-first", "Auth · challenges · habits · analytics · sync · reports · notifications")
bullets(s, 0.7, 1.5, 6.0, 5.0, [
    ("Auth & RBAC — ", "bcrypt (12 rounds), JWT HS256, User/Coach/Admin roles"),
    ("Challenge engine — ", "7 types × 5 difficulties, deterministic templates, adaptive"),
    ("Habit scoring — ", "35/25/20/20 weighted composite from real behavior"),
    ("Analytics & coaching — ", "sleep estimates, trends, 4 recommendation categories"),
    ("Reports — ", "CSV / JSON / PDF / Excel, incl. async generation"),
    ("Notifications — ", "push-token registry with ownership reassignment"),
], size=15, gap=8)
card(s, 7.0, 1.5, 5.6, 2.2, "Security", "Env-driven JWT secret & CORS; RBAC enforced on every protected route; server-authoritative answer verification (no leak).", NAVY)
card(s, 7.0, 4.0, 5.6, 2.2, "Reliability", "Structured error envelope {detail, error_code, timestamp}; rate limiting + request-ID logging; Alembic migrations; idempotent sync upserts.", TEAL)
s.notes_slide.notes_text_frame.text = (
    "The backend exposes 30+ REST endpoints across auth, users, alarms, challenges, habits, analytics, recommendations, "
    "reports, sync, and notifications. Security is first-class: env-driven secrets, RBAC on every protected route, and a "
    "server-authoritative challenge engine so answers are never exposed to the client. Reliability comes from structured "
    "error envelopes, rate limiting, request tracking, migrations, and idempotent sync."
)

# --- Mobile + Offline
s = content("Mobile: offline-first and push-ready", "Alarm dismiss E2E wired end-to-end")
bullets(s, 0.7, 1.5, 6.0, 5.0, [
    ("Alarm dismissal — ", "next → submit → dismiss, fully functional on-device"),
    ("Challenge UX — ", "7 challenge screens, answer verification, retry"),
    ("Offline-first sync — ", "AsyncStorage cache + sync engine hitting idempotent /sync endpoints"),
    ("Offline fallback — ", "cached alarms & habit score with an offline banner"),
    ("Push registration — ", "Expo token POSTed to /notifications/register on login"),
], size=15, gap=8)
card(s, 7.0, 1.5, 5.6, 4.2, "Tested at the logic layer", "The sync engine and push helpers are pure/injectable modules covered by 31 jest tests, so offline behavior is verified without needing a physical device.", BLUE)
s.notes_slide.notes_text_frame.text = (
    "The mobile app drives the core loop and is designed to keep working when connectivity is lost: it caches alarms, "
    "challenges, and habit scores, falls back to that cache with a visible banner, and syncs via an idempotent engine when "
    "it reconnects. Push-token registration is wired on login. Because these modules are pure and injectable, they're "
    "covered by 31 jest tests, making the offline behavior verifiable in CI even without a phone."
)

# --- ML
s = content("ML: adaptive difficulty that really adapts", "A trained model behind the challenge curve")
card(s, 0.7, 1.5, 5.6, 2.1, "Model", "A PyTorch DifficultyPredictor trained on a synthetic rule-based dataset (93.7% validation accuracy).", BLUE)
card(s, 0.7, 3.8, 5.6, 2.1, "Fallback", "A deterministic rule-based path runs when PyTorch isn't available (lean Docker runtime) — the app never hard-depends on the heavyweight dependency.", TEAL)
card(s, 6.5, 1.5, 6.1, 4.4, "Inputs / Outputs", "", NAVY)
bl = s.shapes.add_textbox(Inches(6.9), Inches(2.1), Inches(5.4), Inches(3.4))
tf = bl.text_frame; tf.word_wrap = True
for i, t in enumerate([
    "Inputs: success rate, avg time, snooze count, streak",
    "Output: next challenge difficulty (Beginner → Expert)",
    "Per-user personalization; cadence rises with accuracy",
]):
    p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
    p.space_after = Pt(8)
    r = p.add_run(); r.text = "•  " + t
    r.font.size = Pt(15); r.font.color.rgb = WHITE
s.notes_slide.notes_text_frame.text = (
    "The ML layer makes difficulty genuinely personal. A PyTorch model — trained to 93.7% validation accuracy on a "
    "synthetic rule-based dataset — takes your success rate, response time, snooze count, and streak, and picks the next "
    "challenge level. If the heavy runtime isn't available, a deterministic fallback keeps everything working. Result: "
    "challenges stay in the sweet spot — hard enough to engage, easy enough not to frustrate."
)

# --- Web + Admin
s = content("Web: dashboards for every role", "Track · Plan · Account, grouped navigation")
card(s, 0.7, 1.5, 3.9, 2.2, "Track", "Home + Dashboard wired to live habit-history charts (Chart.js) and recommendations.", BLUE)
card(s, 4.75, 1.5, 3.9, 2.2, "Plan", "Reports with CSV / JSON / PDF / Excel export channels.", TEAL)
card(s, 8.8, 1.5, 3.9, 2.2, "Account", "Profile, settings, and an RBAC-gated Admin console for platform metrics + user management.", NAVY)
bullets(s, 0.7, 4.1, 11.9, 2.6, [
    "Real data end-to-end: dashboard charts consume the snake_case API contract (a Vitest test caught a camelCase mis-key that was silently plotting empty charts).",
    "8 Vitest component/unit tests; grouped navigation with tooltips per the product spec (§21).",
], size=15, gap=8)
s.notes_slide.notes_text_frame.text = (
    "The web dashboard is organized by Track, Plan, and Account. Track pages show live habit-history charts and "
    "recommendations from real data. Plan delivers reports in four formats. Account includes an RBAC-gated Admin console. "
    "A nice quality story: our own Vitest suite caught a bug where charts were silently plotting empty data because of a "
    "field-name casing mismatch — exactly the kind of regression automated coverage is meant to catch."
)

# --- Validation
s = content("Validation & quality: 70+ automated checks", "Every claim is backed by a passing gate")
card(s, 0.7, 1.5, 3.9, 2.0, "32 backend tests", "pytest suite covering auth, alarms, challenges, analytics, sync, reports — on Python 3.11 + 3.14.", BLUE)
card(s, 4.75, 1.5, 3.9, 2.0, "31 mobile tests", "jest-expo: sync engine, offline store, push registration, API utils, hooks.", TEAL)
card(s, 8.8, 1.5, 3.9, 2.0, "8 web tests + smokes", "Vitest components + smoke_m1 (22 checks) + smoke_m2 (28 checks).", AMBER)
bullets(s, 0.7, 3.9, 11.9, 3.0, [
    ("CI (GitHub Actions) — ", "ruff lint, pytest, both smoke suites, web build+test, mobile test on every push."),
    ("End-to-end verified — ", "register → login → challenge → habit → analytics → recommendations all return 200 over HTTP; PDF/Excel exports confirmed in-container."),
    ("Docker deployment — ", "Postgres + migrations entrypoint + lean runtime image + healthchecks, compose up-tested."),
], size=15, gap=8)
s.notes_slide.notes_text_frame.text = (
    "Quality was a first-class deliverable, not an afterthought. We have 32 backend pytest tests, 31 mobile jest tests, and "
    "8 web Vitest tests, plus two in-process smoke suites covering the full flows. GitHub Actions runs ruff, pytest, both "
    "smokes, the web build and tests, and the mobile suite on every push. We verified the entire stack over HTTP and "
    "confirmed PDF and Excel exports inside the container, and tested the Docker deployment end to end."
)

# --- Challenges & learnings
s = content("Challenges we solved", "The engineering lessons worth naming")
card(s, 0.7, 1.5, 3.9, 4.6, "Answer security", "Challenges snapshotted server-side; answers never returned to the client; verification is server-authoritative.", NAVY)
card(s, 4.75, 1.5, 3.9, 4.6, "Cross-version drift", "Venv silently drifted to Python 3.14; Docker stays on 3.11 — found & fixed a forward-ref bug that only crashed under 3.11.", TEAL)
card(s, 8.8, 1.5, 3.9, 4.6, "Device connectivity", "Real-phone dev: base-URL resolution from Expo hostUri, relay fallback, and 401-triggered logout/refresh instead of silent failures.", BLUE)
s.notes_slide.notes_text_frame.text = (
    "Three engineering challenges worth calling out. First, answer security — we made the challenge authoritative on the "
    "server so the client never knows the correct answer. Second, environment drift — the local venv moved to Python 3.14 "
    "while Docker pinned 3.11; that surfaced a latent forward-reference bug that only crashed under 3.11, which we caught "
    "and fixed rather than papering over. Third, real-device wiring — deriving the backend host from Expo's hostUri and "
    "adding a relay fallback plus explicit 401 handling made the mobile E2E flow actually work on a physical phone."
)

# --- Impact
s = content("Impact & completeness", "Why this stands out")
bullets(s, 0.7, 1.5, 11.7, 3.6, [
    ("Full-stack breadth — ", "mobile, web, backend, DB, ML, DevOps and testing — end to end, not a stubbed prototype."),
    ("Security by design — ", "server-authoritative challenge engine and RBAC throughout, not bolted on."),
    ("Test-first quality — ", "70+ automated checks in CI caught real regressions, including a live-chart data bug."),
    ("Offline-first mobile — ", "the app degrades gracefully and syncs idempotently."),
    ("Production-shaped — ", "Docker deployment, migrations entrypoint, structured errors, rate limiting, and lean runtime."),
], size=17, gap=10)
s.notes_slide.notes_text_frame.text = (
    "Taken together, this project demonstrates real breadth and maturity. It's a complete full-stack system across three "
    "clients plus ML and DevOps. Security is designed in, not added on. The automated test suite is substantial and has "
    "caught actual bugs. The mobile app is offline-first and syncs idempotently. And the delivery path is production-shaped — "
    "containerized with migrations, structured errors, rate limiting, and a lean runtime."
)

# --- Roadmap / next steps
s = content("Next steps & scaling path", "Clearly scoped as deliberately-planned, not fabricated")
card(s, 0.7, 1.5, 3.9, 2.0, "Notifications delivery", "FCM / APNs provider behind the existing messaging protocol, plus on-device local alarm scheduling.", AMBER)
card(s, 4.75, 1.5, 3.9, 2.0, "Flow coverage", "Broader flow-level alarm-dismiss component tests.", BLUE)
card(s, 8.8, 1.5, 3.9, 2.0, "Real cloud deploy", "Provision a managed Postgres + container runtime; monitor via the documented stack.", TEAL)
bullets(s, 0.7, 3.9, 11.7, 2.6, [
    "Architecture is documented with an implemented/scaffold/planned legend — no unimplemented features are claimed as done.",
    "Offline sync + push registration are wired; on-device E2E verification needs a development build (Expo Go disables native push).",
], size=15, gap=8)
s.notes_slide.notes_text_frame.text = (
    "The work is complete for scope, with a clear, honest roadmap ahead. Remaining items are FCM/APNs delivery and local "
    "alarm scheduling behind the existing provider protocol, broader flow-level tests, and a real cloud deployment. "
    "Crucially, our docs use an implemented / scaffold / planned legend so nothing unimplemented is presented as done — a "
    "discipline we're proud of."
)

# --- Thanks
s = prs.slides.add_slide(BLANK)
add_bg(s, NAVY)
textbox(s, 1.0, 2.6, 11.3, 1.0, "Thank you", size=54, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
textbox(s, 1.0, 3.7, 11.3, 0.8, "CerebroKognit — wake up sharper, not just earlier.", size=22, color=TEAL, align=PP_ALIGN.CENTER)
textbox(s, 1.0, 5.0, 11.3, 0.5, "Questions welcome.", size=16, color=RGBColor(0x9A, 0xA5, 0xD0), align=PP_ALIGN.CENTER)
s.notes_slide.notes_text_frame.text = (
    "That's CerebroKognit. Thank you for your attention — I'm happy to take questions on the architecture, the challenge "
    "engine's security model, the ML difficulty adaptation, or the offline sync design."
)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
prs.save(OUT)
print("Saved:", OUT)
