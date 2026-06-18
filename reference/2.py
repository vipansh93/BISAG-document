import streamlit as st
import ee
import folium
from folium.plugins import Draw, MiniMap, SideBySideLayers
from streamlit_folium import st_folium
import datetime
import json
import requests

st.set_page_config(
    layout="wide",
    page_title="GeoChronos — Satellite Change Detection",
    page_icon="🛰️",
    initial_sidebar_state="expanded",
)

# =====================================================================
# DESIGN SYSTEM — INJECT CUSTOM CSS + JS
# =====================================================================
CUSTOM_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&family=JetBrains+Mono:wght@400;600&display=swap');

:root {
  --bg-void:    #060810;
  --bg-surface: #0c0f1a;
  --bg-card:    #111626;
  --bg-elevated:#16203a;
  --border:     rgba(56,189,248,0.12);
  --border-glow:rgba(56,189,248,0.45);
  --accent:     #38bdf8;
  --accent-2:   #818cf8;
  --accent-hot: #f472b6;
  --danger:     #f87171;
  --success:    #34d399;
  --text-1:     #e2e8f0;
  --text-2:     #94a3b8;
  --text-3:     #475569;
  --radius:     10px;
  --shadow:     0 4px 24px rgba(0,0,0,.6);
}

/* ── GLOW TEXT (ported from React design system) ───────────── */
.glow-text {
  background: linear-gradient(135deg, #e2e8f0 0%, var(--accent) 50%, var(--accent-2) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 12px rgba(56,189,248,0.35));
}
.glow-accent {
  box-shadow: 0 0 20px rgba(56,189,248,.25), 0 0 40px rgba(56,189,248,.1);
}

html, body, [data-testid="stApp"] {
  background: var(--bg-void) !important;
  color: var(--text-1) !important;
  font-family: 'Space Grotesk', sans-serif !important;
}

[data-testid="stAppViewContainer"] {
  background: var(--bg-void) !important;
  position: relative;
  z-index: auto;
}

.main {
  background: transparent !important;
  color: var(--text-1) !important;
  font-family: 'Space Grotesk', sans-serif !important;
  position: relative;
  z-index: 2;
}

[data-testid="stAppViewContainer"]::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image:
    radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,.35) 0%, transparent 100%),
    radial-gradient(1px 1px at 30% 60%, rgba(255,255,255,.25) 0%, transparent 100%),
    radial-gradient(1px 1px at 55% 10%, rgba(255,255,255,.30) 0%, transparent 100%),
    radial-gradient(1px 1px at 80% 70%, rgba(255,255,255,.20) 0%, transparent 100%),
    radial-gradient(1px 1px at 65% 40%, rgba(255,255,255,.28) 0%, transparent 100%),
    radial-gradient(1px 1px at 15% 85%, rgba(255,255,255,.22) 0%, transparent 100%),
    radial-gradient(1px 1px at 90% 30%, rgba(255,255,255,.26) 0%, transparent 100%),
    radial-gradient(1px 1px at 45% 75%, rgba(255,255,255,.18) 0%, transparent 100%),
    radial-gradient(2px 2px at 72% 18%, rgba(56,189,248,.4) 0%, transparent 100%),
    radial-gradient(2px 2px at 24% 45%, rgba(129,140,248,.3) 0%, transparent 100%);
  pointer-events: none;
  z-index: 0;
  animation: twinkle 8s ease-in-out infinite alternate;
}

@keyframes twinkle {
  0%   { opacity: 0.6; }
  50%  { opacity: 1.0; }
  100% { opacity: 0.7; }
}

[data-testid="stAppViewContainer"]::after {
  content: '';
  position: fixed;
  top: -40vh; left: 50%;
  transform: translateX(-50%);
  width: 90vw; height: 90vw;
  max-width: 1000px; max-height: 1000px;
  border-radius: 50%;
  border: 1px solid rgba(56,189,248,0.06);
  box-shadow: 0 0 60px rgba(56,189,248,0.04) inset;
  pointer-events: none;
  z-index: 0;
  animation: orbit-pulse 12s ease-in-out infinite alternate;
}
@keyframes orbit-pulse {
  0%   { transform: translateX(-50%) scale(0.97); opacity:0.4; }
  100% { transform: translateX(-50%) scale(1.03); opacity:0.9; }
}

.block-container {
  padding: 1.5rem 2rem 3rem !important;
  max-width: 1400px !important;
  position: relative;
  z-index: 2;
}

.terra-hero {
  text-align: center;
  padding: 2.2rem 0 1.6rem;
  animation: hero-in 0.8s cubic-bezier(.22,1,.36,1) both;
}
@keyframes hero-in {
  from { opacity:0; transform: translateY(-28px); }
  to   { opacity:1; transform: translateY(0); }
}
.terra-eyebrow {
  font-family: 'Space Mono', monospace;
  font-size: 0.68rem;
  letter-spacing: 0.3em;
  color: var(--accent);
  text-transform: uppercase;
  margin-bottom: 0.6rem;
  opacity: 0.85;
}
.terra-title {
  font-size: clamp(2rem, 4vw, 3.2rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
  background: linear-gradient(135deg, #e2e8f0 30%, var(--accent) 70%, var(--accent-2) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 14px rgba(56,189,248,0.3));
  margin: 0 0 0.6rem;
}
.terra-subtitle {
  color: var(--text-2);
  font-size: 0.95rem;
  font-weight: 400;
  max-width: 600px;
  margin: 0 auto;
  line-height: 1.6;
}
.terra-badge {
  display: inline-block;
  margin: 1rem 0.3rem 0;
  padding: 0.22rem 0.7rem;
  border-radius: 20px;
  font-family: 'Space Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  background: rgba(56,189,248,0.08);
  border: 1px solid rgba(56,189,248,0.2);
  color: var(--accent);
  transition: all 0.3s cubic-bezier(.22,1,.36,1);
  animation: badge-pop 0.5s ease both;
}
.terra-badge:hover {
  border-color: var(--accent);
  box-shadow: 0 0 14px rgba(56,189,248,.25);
  transform: translateY(-1px);
}
@keyframes badge-pop {
  from { transform: scale(0.8); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}

/* ── GLASS TOP BAR (mirrors the React Navbar) ───────────────── */
.terra-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.55rem 1.1rem;
  margin: 0 0 1.4rem;
  border-radius: 999px;
  background: rgba(17,22,40,0.55);
  backdrop-filter: blur(16px) saturate(1.2);
  -webkit-backdrop-filter: blur(16px) saturate(1.2);
  border: 1px solid rgba(56,189,248,0.14);
  animation: hero-in 0.7s cubic-bezier(.22,1,.36,1) both;
}
.terra-topbar-brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.terra-topbar-logo {
  width: 30px; height: 30px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: 0 0 18px rgba(56,189,248,.3);
}
.terra-topbar-name {
  font-family: 'Space Mono', monospace;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.16em;
}
.terra-topbar-sub {
  font-family: 'Space Mono', monospace;
  font-size: 0.55rem;
  letter-spacing: 0.18em;
  color: var(--text-3);
  text-transform: uppercase;
}
.terra-topbar-status {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: 'Space Mono', monospace;
  font-size: 0.66rem;
  letter-spacing: 0.1em;
  color: var(--success);
  text-transform: uppercase;
}

/* ── SECTION TITLE (mirrors React .section-title eyebrow) ───── */
.section-title {
  font-family: 'Space Mono', monospace;
  font-size: 0.66rem;
  letter-spacing: 0.26em;
  text-transform: uppercase;
  color: var(--accent);
  display: flex;
  align-items: center;
  gap: 0.7rem;
  margin-bottom: 0.2rem;
}
.section-title::before {
  content: '';
  width: 20px; height: 1px;
  background: linear-gradient(90deg, var(--accent), transparent);
}

/* ── TECH MARQUEE STRIP ──────────────────────────────────────── */
.terra-marquee {
  position: relative;
  overflow: hidden;
  border-top: 1px solid rgba(56,189,248,0.1);
  border-bottom: 1px solid rgba(56,189,248,0.1);
  padding: 0.65rem 0;
  margin: 0.4rem 0 1.6rem;
}
.terra-marquee::before, .terra-marquee::after {
  content: '';
  position: absolute;
  top: 0; bottom: 0;
  width: 60px;
  z-index: 2;
  pointer-events: none;
}
.terra-marquee::before { left: 0;  background: linear-gradient(90deg, var(--bg-void), transparent); }
.terra-marquee::after  { right: 0; background: linear-gradient(270deg, var(--bg-void), transparent); }
.terra-marquee-track {
  display: flex;
  white-space: nowrap;
  animation: marquee-scroll 28s linear infinite;
  width: max-content;
}
.terra-marquee-item {
  font-family: 'Space Mono', monospace;
  font-size: 0.66rem;
  letter-spacing: 0.22em;
  color: var(--text-3);
  margin: 0 1.4rem;
  display: flex;
  align-items: center;
  gap: 1.4rem;
}
.terra-marquee-item .dot { color: var(--accent); }
@keyframes marquee-scroll {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

/* ── CARD SHINE UTILITY (used in feature/metric wrappers) ────── */
.terra-card-row {
  display: grid;
  gap: 0.9rem;
  margin: 0.6rem 0 1.4rem;
}

[data-testid="stSidebar"] {
  background: var(--bg-surface) !important;
  border-right: 1px solid var(--border) !important;
}
[data-testid="stSidebar"] > div:first-child {
  padding: 1.2rem 1rem !important;
}
[data-testid="stSidebar"] .block-container {
  padding: 0 !important;
}
[data-testid="stSidebar"] h3 {
  font-family: 'Space Mono', monospace !important;
  font-size: 0.62rem !important;
  letter-spacing: 0.22em !important;
  text-transform: uppercase !important;
  color: var(--accent) !important;
  border-bottom: 1px solid var(--border) !important;
  padding-bottom: 0.45rem !important;
  margin: 1.2rem 0 0.7rem !important;
}

[data-testid="stSlider"] > div > div > div > div {
  background: linear-gradient(90deg, var(--accent) 0%, var(--accent-2) 100%) !important;
}
[data-testid="stSlider"] > div > div > div > div > div {
  background: var(--accent) !important;
  box-shadow: 0 0 10px var(--accent), 0 0 20px rgba(56,189,248,.3) !important;
  border: 2px solid white !important;
  width: 18px !important; height: 18px !important;
  top: -6px !important;
  transition: transform 0.15s ease, box-shadow 0.15s ease !important;
}
[data-testid="stSlider"] > div > div > div > div > div:hover {
  transform: scale(1.3) !important;
  box-shadow: 0 0 16px var(--accent), 0 0 32px rgba(56,189,248,.5) !important;
}
[data-testid="stSlider"] label {
  color: var(--text-2) !important;
  font-size: 0.8rem !important;
  font-family: 'Space Grotesk', sans-serif !important;
}

[data-testid="stButton"] button {
  background: linear-gradient(135deg, #0f2d4d 0%, #0c1f36 100%) !important;
  border: 1px solid var(--border-glow) !important;
  color: var(--accent) !important;
  font-family: 'Space Mono', monospace !important;
  font-size: 0.75rem !important;
  letter-spacing: 0.06em !important;
  border-radius: var(--radius) !important;
  padding: 0.6rem 1.2rem !important;
  transition: all 0.25s cubic-bezier(.22,1,.36,1) !important;
  position: relative; overflow: hidden;
}
[data-testid="stButton"] button:hover {
  border-color: var(--accent) !important;
  box-shadow: 0 0 20px rgba(56,189,248,.25), 0 4px 16px rgba(0,0,0,.4) !important;
  transform: translateY(-2px) !important;
}
[data-testid="stButton"] button:active { transform: translateY(0px) !important; }

[data-testid="stDownloadButton"] button {
  background: linear-gradient(135deg, rgba(52,211,153,.08) 0%, rgba(56,189,248,.06) 100%) !important;
  border: 1px solid rgba(52,211,153,.3) !important;
  color: var(--success) !important;
  font-family: 'Space Mono', monospace !important;
  font-size: 0.75rem !important;
  border-radius: var(--radius) !important;
  transition: all 0.25s ease !important;
}
[data-testid="stDownloadButton"] button:hover {
  border-color: var(--success) !important;
  box-shadow: 0 0 16px rgba(52,211,153,.2) !important;
  transform: translateY(-2px) !important;
}

[data-testid="stMetric"] {
  background: linear-gradient(135deg, rgba(17,22,40,0.85) 0%, rgba(12,15,26,0.85) 100%) !important;
  border: 1px solid var(--border) !important;
  border-radius: var(--radius) !important;
  padding: 1rem 1.2rem !important;
  transition: border-color 0.35s cubic-bezier(.22,1,.36,1), box-shadow 0.35s cubic-bezier(.22,1,.36,1), transform 0.35s cubic-bezier(.22,1,.36,1) !important;
  animation: card-in 0.5s ease both !important;
  position: relative !important;
  overflow: hidden !important;
}
[data-testid="stMetric"]::after {
  content: '';
  position: absolute;
  top: -50%; left: -50%;
  width: 200%; height: 200%;
  background: linear-gradient(45deg, transparent 30%, rgba(56,189,248,0.07) 50%, transparent 70%);
  transform: rotate(45deg) translateX(-100%);
  transition: transform 0.8s ease;
  pointer-events: none;
}
[data-testid="stMetric"]:hover::after { transform: rotate(45deg) translateX(100%); }
[data-testid="stMetric"]:hover {
  border-color: var(--border-glow) !important;
  box-shadow: 0 8px 32px rgba(56,189,248,.12), 0 0 0 1px rgba(56,189,248,.1) !important;
  transform: translateY(-4px) !important;
}
@keyframes card-in {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
[data-testid="stMetric"] label {
  color: var(--text-2) !important;
  font-family: 'Space Mono', monospace !important;
  font-size: 0.65rem !important;
  letter-spacing: 0.1em !important;
  text-transform: uppercase !important;
}
[data-testid="stMetricValue"] {
  font-family: 'Space Grotesk', sans-serif !important;
  font-size: 1.8rem !important;
  font-weight: 700 !important;
  color: var(--text-1) !important;
}

[data-testid="stAlert"] {
  border-radius: var(--radius) !important;
  border: none !important;
  font-family: 'Space Grotesk', sans-serif !important;
  font-size: 0.85rem !important;
  animation: alert-slide 0.4s ease both !important;
}
@keyframes alert-slide {
  from { opacity:0; transform:translateX(-12px); }
  to   { opacity:1; transform:translateX(0); }
}

.element-container .stSuccess {
  background: rgba(52,211,153,.07) !important;
  border-left: 3px solid var(--success) !important;
  color: var(--success) !important;
  border-radius: var(--radius) !important;
}
.element-container .stError {
  background: rgba(248,113,113,.07) !important;
  border-left: 3px solid var(--danger) !important;
  color: var(--danger) !important;
  border-radius: var(--radius) !important;
}

[data-testid="stSpinner"] > div {
  border-color: var(--accent) transparent transparent transparent !important;
}

.main h3 {
  font-family: 'Space Mono', monospace !important;
  font-size: 0.72rem !important;
  letter-spacing: 0.2em !important;
  text-transform: uppercase !important;
  color: var(--accent) !important;
  margin: 2rem 0 1rem !important;
  padding-bottom: 0.4rem !important;
  border-bottom: 1px solid var(--border) !important;
  animation: heading-in 0.4s ease both !important;
}
@keyframes heading-in {
  from { opacity:0; transform:translateX(-8px); }
  to   { opacity:1; transform:translateX(0); }
}
.main h4 {
  font-family: 'Space Grotesk', sans-serif !important;
  font-size: 0.9rem !important;
  font-weight: 600 !important;
  color: var(--text-2) !important;
  margin: 1.4rem 0 0.6rem !important;
}

[data-testid="stExpander"] {
  background: var(--bg-card) !important;
  border: 1px solid var(--border) !important;
  border-radius: var(--radius) !important;
  overflow: hidden !important;
}
[data-testid="stExpander"] summary {
  font-family: 'Space Mono', monospace !important;
  font-size: 0.75rem !important;
  letter-spacing: 0.06em !important;
  color: var(--text-2) !important;
  padding: 0.8rem 1rem !important;
  cursor: pointer;
  transition: color 0.2s ease !important;
}
[data-testid="stExpander"] summary:hover { color: var(--accent) !important; }

.map-wrapper {
  border-radius: var(--radius) !important;
  overflow: hidden !important;
  border: 1px solid var(--border) !important;
  box-shadow: 0 0 0 1px var(--border), var(--shadow) !important;
  transition: box-shadow 0.3s ease !important;
}
.map-wrapper:hover {
  box-shadow: 0 0 0 1px var(--border-glow), 0 0 30px rgba(56,189,248,.08), var(--shadow) !important;
}
iframe { border-radius: var(--radius) !important; }

.scan-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--accent) 40%, var(--accent-2) 60%, transparent 100%);
  margin: 2rem 0;
  opacity: 0.4;
  animation: scan-pulse 3s ease-in-out infinite alternate;
}
@keyframes scan-pulse {
  from { opacity: 0.25; }
  to   { opacity: 0.55; }
}

.status-dot {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 8px var(--success);
  animation: dot-pulse 2s ease-in-out infinite;
  margin-right: 0.4rem;
  vertical-align: middle;
}
@keyframes dot-pulse {
  0%, 100% { box-shadow: 0 0 6px var(--success); }
  50%       { box-shadow: 0 0 14px var(--success), 0 0 24px rgba(52,211,153,.4); }
}

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: var(--bg-void); }
::-webkit-scrollbar-thumb { background: var(--border-glow); border-radius: 4px; }

[data-testid="stSelectbox"] > div > div,
[data-testid="stNumberInput"] input {
  background: var(--bg-elevated) !important;
  border: 1px solid var(--border) !important;
  border-radius: var(--radius) !important;
  color: var(--text-1) !important;
  font-family: 'Space Grotesk', sans-serif !important;
  transition: border-color 0.2s ease !important;
}
[data-testid="stSelectbox"] > div > div:hover,
[data-testid="stNumberInput"] input:focus {
  border-color: var(--border-glow) !important;
  box-shadow: 0 0 10px rgba(56,189,248,.1) !important;
}

.stFolium { border-radius: var(--radius) !important; }

.instruction-box {
  background: linear-gradient(135deg, rgba(56,189,248,.05) 0%, rgba(129,140,248,.04) 100%);
  border: 1px solid rgba(56,189,248,.18);
  border-left: 3px solid var(--accent);
  border-radius: var(--radius);
  padding: 1rem 1.2rem;
  font-size: 0.88rem;
  color: var(--text-2);
  margin: 0.8rem 0;
  animation: alert-slide 0.4s ease both;
  line-height: 1.65;
}
.instruction-box strong { color: var(--accent); }

.main p, .main li {
  color: var(--text-2) !important;
  font-family: 'Space Grotesk', sans-serif !important;
  line-height: 1.7 !important;
  font-size: 0.88rem !important;
}
.main strong { color: var(--accent) !important; }
.main code {
  background: rgba(56,189,248,.08) !important;
  border: 1px solid rgba(56,189,248,.15) !important;
  border-radius: 4px !important;
  padding: 0.1em 0.35em !important;
  font-family: 'Space Mono', monospace !important;
  font-size: 0.8rem !important;
  color: var(--accent) !important;
}

hr {
  border: none !important;
  height: 1px !important;
  background: var(--border) !important;
  margin: 1.5rem 0 !important;
}

.sidebar-logo {
  text-align: center;
  padding: 0.8rem 0 0.4rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 0.6rem;
}
.sidebar-logo-text {
  font-family: 'Space Mono', monospace;
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.sidebar-logo-sub {
  font-size: 0.62rem;
  letter-spacing: 0.2em;
  color: var(--text-3);
  text-transform: uppercase;
  margin-top: 0.15rem;
}

[data-testid="column"]:nth-child(1) [data-testid="stMetric"] { animation-delay: 0.0s; }
[data-testid="column"]:nth-child(2) [data-testid="stMetric"] { animation-delay: 0.08s; }
[data-testid="column"]:nth-child(3) [data-testid="stMetric"] { animation-delay: 0.16s; }
[data-testid="column"]:nth-child(4) [data-testid="stMetric"] { animation-delay: 0.24s; }
[data-testid="column"]:nth-child(5) [data-testid="stMetric"] { animation-delay: 0.32s; }
[data-testid="column"]:nth-child(6) [data-testid="stMetric"] { animation-delay: 0.40s; }

/* ── SWIPE COMPARISON WIDGET STYLING ────────────────────────── */
.swipe-label-left {
  position: absolute;
  top: 12px; left: 12px;
  z-index: 1000;
  background: rgba(6,8,16,0.82);
  border: 1px solid rgba(56,189,248,0.35);
  border-radius: 6px;
  padding: 4px 10px;
  font-family: 'Space Mono', monospace;
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  color: #38bdf8;
  pointer-events: none;
}
.swipe-label-right {
  position: absolute;
  top: 12px; right: 12px;
  z-index: 1000;
  background: rgba(6,8,16,0.82);
  border: 1px solid rgba(129,140,248,0.35);
  border-radius: 6px;
  padding: 4px 10px;
  font-family: 'Space Mono', monospace;
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  color: #818cf8;
  pointer-events: none;
}
/* Override leaflet-sbs divider styling to match theme */
.leaflet-sbs-divider {
  background: linear-gradient(180deg, transparent 0%, rgba(56,189,248,0.6) 30%, rgba(56,189,248,0.9) 50%, rgba(56,189,248,0.6) 70%, transparent 100%) !important;
  width: 3px !important;
  box-shadow: 0 0 12px rgba(56,189,248,0.5) !important;
}
.leaflet-sbs-range {
  accent-color: #38bdf8 !important;
}
</style>
"""

st.markdown(CUSTOM_CSS, unsafe_allow_html=True)

# =====================================================================
# 1. EARTH ENGINE INIT & SESSION STATE
# =====================================================================
@st.cache_resource
def initialize_ee():
    try:
        ee.Initialize(project='cdbisag')
        return True
    except Exception as e:
        st.error(f"Failed to connect to Earth Engine: {e}")
        return False

for key in ["detected_geojson", "construction_geojson", "demolition_geojson",
            "saved_aoi_geojson", "raster_download_url", "metrics"]:
    if key not in st.session_state:
        st.session_state[key] = None

if not initialize_ee():
    st.stop()

# =====================================================================
# 2. HERO HEADER
# =====================================================================
st.markdown("""
<div class="terra-topbar">
  <div class="terra-topbar-brand">
    <div class="terra-topbar-logo">🛰️</div>
    <div>
      <div class="terra-topbar-name glow-text">TERRA·WATCH</div>
      <div class="terra-topbar-sub">Change Detection Engine</div>
    </div>
  </div>
  <div class="terra-topbar-status">
    <span class="status-dot"></span> ONLINE
  </div>
</div>

<div class="terra-hero">
  <div class="terra-eyebrow">🛰️ &nbsp; Earth Observation Platform</div>
  <h1 class="terra-title">TERRA·WATCH</h1>
  <p class="terra-subtitle">Multi-index ensemble change detection powered by Sentinel-2 imagery and Google Earth Engine</p>
  <div>
    <span class="terra-badge" style="animation-delay:.1s">Sentinel-2 SR</span>
    <span class="terra-badge" style="animation-delay:.2s">4-Index Ensemble</span>
    <span class="terra-badge" style="animation-delay:.3s">10m Resolution</span>
    <span class="terra-badge" style="animation-delay:.4s">ESA WorldCover</span>
    <span class="terra-badge" style="animation-delay:.5s">⟵ Swipe Compare ⟶</span>
  </div>
</div>

<div class="terra-marquee">
  <div class="terra-marquee-track">
    <div class="terra-marquee-item"><span>GOOGLE EARTH ENGINE</span><span class="dot">◆</span></div>
    <div class="terra-marquee-item"><span>SENTINEL-2 SR</span><span class="dot">◆</span></div>
    <div class="terra-marquee-item"><span>ESA WORLDCOVER</span><span class="dot">◆</span></div>
    <div class="terra-marquee-item"><span>NDBI · NDVI · MNDWI · BSI</span><span class="dot">◆</span></div>
    <div class="terra-marquee-item"><span>10M RESOLUTION</span><span class="dot">◆</span></div>
    <div class="terra-marquee-item"><span>GEOJSON EXPORT</span><span class="dot">◆</span></div>
    <div class="terra-marquee-item"><span>GEOTIFF EXPORT</span><span class="dot">◆</span></div>
    <div class="terra-marquee-item"><span>CLOUD MASKING</span><span class="dot">◆</span></div>
    <div class="terra-marquee-item"><span>ENSEMBLE VOTING</span><span class="dot">◆</span></div>
    <div class="terra-marquee-item"><span>FOLIUM LEAFLET</span><span class="dot">◆</span></div>
    <div class="terra-marquee-item"><span>GOOGLE EARTH ENGINE</span><span class="dot">◆</span></div>
    <div class="terra-marquee-item"><span>SENTINEL-2 SR</span><span class="dot">◆</span></div>
    <div class="terra-marquee-item"><span>ESA WORLDCOVER</span><span class="dot">◆</span></div>
    <div class="terra-marquee-item"><span>NDBI · NDVI · MNDWI · BSI</span><span class="dot">◆</span></div>
    <div class="terra-marquee-item"><span>10M RESOLUTION</span><span class="dot">◆</span></div>
    <div class="terra-marquee-item"><span>GEOJSON EXPORT</span><span class="dot">◆</span></div>
    <div class="terra-marquee-item"><span>GEOTIFF EXPORT</span><span class="dot">◆</span></div>
    <div class="terra-marquee-item"><span>CLOUD MASKING</span><span class="dot">◆</span></div>
    <div class="terra-marquee-item"><span>ENSEMBLE VOTING</span><span class="dot">◆</span></div>
    <div class="terra-marquee-item"><span>FOLIUM LEAFLET</span><span class="dot">◆</span></div>
  </div>
</div>
""", unsafe_allow_html=True)

# =====================================================================
# 3. SIDEBAR — CONTROLS
# =====================================================================
with st.sidebar:
    st.markdown("""
    <div class="sidebar-logo">
      <div class="sidebar-logo-text glow-text">🛰️ TERRA·WATCH</div>
      <div class="sidebar-logo-sub">Change Detection Engine</div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("### 🗓️ Temporal Window")
    current_year = datetime.datetime.now().year
    start_year = st.slider("Baseline Year", 2015, current_year - 1, 2021)
    end_year   = st.slider("Target Year",   2016, current_year,     2025)

    if start_year >= end_year:
        st.error("Baseline must precede target year.")
        st.stop()

    delta_years = end_year - start_year
    st.markdown(f"""
    <div style="font-family:'Space Mono',monospace;font-size:0.68rem;
         color:var(--accent);opacity:0.8;padding:0.3rem 0 0.5rem;
         letter-spacing:0.06em;">
      △ {delta_years} year{"s" if delta_years!=1 else ""} &nbsp;·&nbsp;
      {start_year} → {end_year}
    </div>
    """, unsafe_allow_html=True)

    st.markdown("### 🎛️ Sensitivity")
    construction_thresh = st.slider("Construction Threshold", 0.01, 0.20, 0.03, 0.01,
        help="NDBI change threshold. Lower = more detections.")
    demolition_thresh = st.slider("Demolition Threshold", -0.20, -0.01, -0.04, 0.01,
        help="NDBI drop to flag removed structures.")

    st.markdown("### 🔬 Advanced Filters")
    min_patch_pixels = st.slider("Min Patch Size (px)", 1, 10, 2,
        help="Minimum connected pixels. Keep 2–3 for small AOIs.")
    ndvi_veg_thresh = st.slider("Vegetation Mask NDVI", 0.20, 0.60, 0.40, 0.05,
        help="Exclude pixels greener than this from construction.")
    ensemble_votes = st.slider("Ensemble Votes (of 4)", 1, 4, 1,
        help="Indices that must agree. Use 1 for small AOIs.")

    if st.session_state.detected_geojson or st.session_state.saved_aoi_geojson:
        st.markdown("---")
        if st.button("🧹 Clear All Layers", use_container_width=True):
            for key in ["detected_geojson", "construction_geojson", "demolition_geojson",
                        "saved_aoi_geojson", "raster_download_url", "metrics"]:
                st.session_state[key] = None
            st.rerun()

    st.markdown("---")
    st.markdown("""
    <div style="font-size:0.72rem;color:var(--text-3);font-family:'Space Mono',monospace;">
      <span class="status-dot"></span> Earth Engine Connected
    </div>
    """, unsafe_allow_html=True)

# =====================================================================
# 4. CORE SATELLITE UTILITIES
# =====================================================================
def mask_s2_clouds(image):
    scl = image.select('SCL')
    scl_mask = scl.neq(3).And(scl.neq(8)).And(scl.neq(9)).And(scl.neq(10))
    qa = image.select('QA60')
    qa_mask = qa.bitwiseAnd(1 << 10).eq(0).And(qa.bitwiseAnd(1 << 11).eq(0))
    return image.updateMask(scl_mask.And(qa_mask)).divide(10000)

def get_seasonal_composite(roi, year):
    def half(sm, em):
        return (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                .filterBounds(roi)
                .filterDate(f"{year}-{sm:02d}-01", f"{year}-{em:02d}-28")
                .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
                .map(mask_s2_clouds))
    full = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
            .filterBounds(roi)
            .filterDate(f"{year}-01-01", f"{year}-12-31")
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
            .map(mask_s2_clouds))
    merged = half(1, 6).merge(half(7, 12))
    size = merged.size()
    return ee.Algorithms.If(size.gt(0), merged.median(), full.median())


@st.cache_data(show_spinner=False, ttl=3600)
def get_year_tile_url(aoi_geojson_str, year):
    """
    Returns an XYZ tile URL for the true-color Sentinel-2 composite for `year`.
    Used by BOTH the swipe map and the post-analysis overlay map.
    """
    try:
        roi = ee.Geometry(json.loads(aoi_geojson_str))
        composite = ee.Image(get_seasonal_composite(roi, year)).clip(roi)
        vis_image = composite.select(['B4', 'B3', 'B2']).visualize(
            min=0.0, max=0.35, gamma=1.15
        )
        map_id = vis_image.getMapId()
        return map_id['tile_fetcher'].url_format
    except Exception:
        return None


def compute_indices(img):
    img = ee.Image(img)
    ndbi  = img.normalizedDifference(['B11', 'B8']).rename('NDBI')
    ndvi  = img.normalizedDifference(['B8',  'B4']).rename('NDVI')
    mndwi = img.normalizedDifference(['B3',  'B11']).rename('MNDWI')
    bsi   = img.expression(
        '((B11+B4)-(B8+B2))/((B11+B4)+(B8+B2)+1e-9)',
        {'B11': img.select('B11'), 'B4': img.select('B4'),
         'B8':  img.select('B8'),  'B2': img.select('B2')}
    ).rename('BSI')
    return ee.Image([ndbi, ndvi, mndwi, bsi])

def lightweight_noise_filter(binary_image, min_pixels):
    if min_pixels <= 1:
        return binary_image.unmask(0)
    as_float = binary_image.toFloat()
    if min_pixels <= 3:
        smoothed = as_float.focal_median(radius=1, kernelType='square', units='pixels')
        return smoothed.gt(0.4).unmask(0)
    elif min_pixels <= 6:
        s1 = as_float.focal_median(radius=1, kernelType='square', units='pixels')
        s2 = s1.focal_median(radius=2, kernelType='square', units='pixels')
        return s2.gt(0.4).unmask(0)
    else:
        s1 = as_float.focal_median(radius=1, kernelType='square', units='pixels')
        s2 = s1.focal_median(radius=2, kernelType='square', units='pixels')
        s3 = s2.focal_median(radius=2, kernelType='square', units='pixels')
        return s3.gt(0.45).unmask(0)

def get_worldcover_urban(roi):
    try:
        wc = ee.ImageCollection('ESA/WorldCover/v200').first().clip(roi)
        return wc.eq(50).rename('wc_urban')
    except Exception:
        return None

# =====================================================================
# 5. AOI DRAW MAP  (unchanged – rectangle draw tool)
# =====================================================================
st.markdown('<div class="scan-divider"></div>', unsafe_allow_html=True)
st.markdown("### 📐 Step 1 — Draw Your Area of Interest")
st.markdown("""
<div class="instruction-box">
  Use the <strong>rectangle tool</strong> (top-left of map) to draw a box over your area of interest.
  The swipe comparison and analysis will use this AOI.
</div>
""", unsafe_allow_html=True)

m_init = folium.Map(location=[23.1923, 72.6742], zoom_start=14,
                    tiles=None, prefer_canvas=True)
folium.TileLayer(
    tiles='https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attr='Google', name='Google Satellite', overlay=False, control=True
).add_to(m_init)

Draw(export=False, position='topleft',
     draw_options={
         'polyline': False, 'polygon': False, 'circle': False,
         'marker': False, 'circlemarker': False, 'rectangle': True
     }).add_to(m_init)
MiniMap(toggle_display=True, position='bottomright').add_to(m_init)

# Show previously drawn AOI if it exists
if st.session_state.saved_aoi_geojson is not None:
    folium.GeoJson(
        {"type": "Feature", "geometry": st.session_state.saved_aoi_geojson},
        style_function=lambda _: {
            'color': '#38bdf8', 'weight': 2, 'fillOpacity': 0.08, 'dashArray': '6 4'
        }
    ).add_to(m_init)

output_map = st_folium(
    m_init, width="100%", height=480,
    key="native_folium_map",
    returned_objects=["last_active_drawing", "all_drawings", "last_draw"]
)

# ── Geometry capture ────────────────────────────────────────────────
drawn_geojson = None
if output_map:
    if output_map.get("last_active_drawing"):
        drawn_geojson = output_map["last_active_drawing"]["geometry"]
    elif output_map.get("last_draw"):
        drawn_geojson = output_map["last_draw"]["geometry"]
    elif output_map.get("all_drawings"):
        drawn_geojson = output_map["all_drawings"][-1]["geometry"]

if drawn_geojson:
    st.session_state.saved_aoi_geojson = drawn_geojson

# =====================================================================
# 6. SWIPE COMPARISON MAP  ← NEW SECTION
#    Shown as soon as an AOI is drawn, BEFORE running analysis.
#    Uses folium SideBySideLayers with the two EE tile layers.
# =====================================================================
if st.session_state.saved_aoi_geojson is not None:
    st.markdown('<div class="scan-divider"></div>', unsafe_allow_html=True)
    st.markdown("### 🔭 Step 2 — Swipe & Compare Years")
    st.markdown(f"""
    <div style="display:flex;align-items:center;gap:1.4rem;margin-bottom:0.9rem;
         font-family:'Space Mono',monospace;font-size:0.72rem;">
      <span style="color:#38bdf8;padding:3px 10px;border:1px solid rgba(56,189,248,.3);
            border-radius:5px;background:rgba(56,189,248,.06);">
        ← {start_year} BASELINE
      </span>
      <span style="color:var(--text-3);">drag the divider to compare</span>
      <span style="color:#818cf8;padding:3px 10px;border:1px solid rgba(129,140,248,.3);
            border-radius:5px;background:rgba(129,140,248,.06);">
        {end_year} TARGET →
      </span>
    </div>
    """, unsafe_allow_html=True)

    aoi_key = json.dumps(st.session_state.saved_aoi_geojson, sort_keys=True)

    # Derive map centre
    try:
        coords = st.session_state.saved_aoi_geojson.get("coordinates", [[[72.6742, 23.1923]]])
        flat   = coords[0] if coords else [[72.6742, 23.1923]]
        lons   = [c[0] for c in flat]
        lats   = [c[1] for c in flat]
        map_center = [(min(lats) + max(lats)) / 2, (min(lons) + max(lons)) / 2]
    except Exception:
        map_center = [23.1923, 72.6742]

    # Build swipe map
    m_swipe = folium.Map(location=map_center, zoom_start=16,
                         tiles=None, prefer_canvas=True)

    # Google Satellite basemap (always visible under both panels)
    folium.TileLayer(
        tiles='https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        attr='Google', name='Google Satellite',
        overlay=False, control=False, show=True
    ).add_to(m_swipe)

    with st.spinner(f"Loading {start_year} imagery…"):
        baseline_tiles = get_year_tile_url(aoi_key, start_year)
    with st.spinner(f"Loading {end_year} imagery…"):
        target_tiles = get_year_tile_url(aoi_key, end_year)

    swipe_ok = False
    if baseline_tiles and target_tiles:
        # Left panel — baseline year
        layer_left = folium.TileLayer(
            tiles=baseline_tiles,
            attr='GEE / Sentinel-2',
            name=f'{start_year} Baseline',
            overlay=True, control=False, show=True, opacity=1.0
        )
        layer_left.add_to(m_swipe)

        # Right panel — target year
        layer_right = folium.TileLayer(
            tiles=target_tiles,
            attr='GEE / Sentinel-2',
            name=f'{end_year} Target',
            overlay=True, control=False, show=True, opacity=1.0
        )
        layer_right.add_to(m_swipe)

        # Side-by-side plugin wires the two layers to the drag handle
        SideBySideLayers(layer_left=layer_left, layer_right=layer_right).add_to(m_swipe)

        # AOI boundary
        folium.GeoJson(
            {"type": "Feature", "geometry": st.session_state.saved_aoi_geojson},
            style_function=lambda _: {
                'color': '#38bdf8', 'weight': 2.5, 'fillOpacity': 0, 'dashArray': '6 4'
            }
        ).add_to(m_swipe)

        swipe_ok = True
    else:
        if not baseline_tiles:
            st.warning(f"⚠️ No cloud-free Sentinel-2 imagery found for **{start_year}** in this area. "
                       "Try a different year or a larger AOI.")
        if not target_tiles:
            st.warning(f"⚠️ No cloud-free Sentinel-2 imagery found for **{end_year}** in this area.")

    if swipe_ok:
        st_folium(m_swipe, width="100%", height=560,
                  key="swipe_map", returned_objects=[])

    # ── After-analysis overlay map (change polygons + toggleable layers) ──
    if st.session_state.detected_geojson is not None:
        st.markdown('<div class="scan-divider"></div>', unsafe_allow_html=True)
        st.markdown("### 🛰️ Step 3 — Imagery & Change Overlay")
        st.markdown("""
        <div style="color:var(--text-2);font-size:0.85rem;margin-bottom:0.8rem;">
          Use the layer checkboxes (top-right) to toggle Baseline, Target, and Change Detection
          results independently on the same map.
        </div>
        """, unsafe_allow_html=True)

        m_overlay = folium.Map(location=map_center, zoom_start=16,
                               tiles=None, prefer_canvas=True)

        folium.TileLayer(
            tiles='https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            attr='Google', name='Google Satellite',
            overlay=False, control=False, show=True
        ).add_to(m_overlay)

        if baseline_tiles:
            folium.TileLayer(
                tiles=baseline_tiles,
                attr='GEE / Sentinel-2',
                name=f'📅 Baseline — {start_year}',
                overlay=True, control=True, show=True, opacity=0.9
            ).add_to(m_overlay)

        if target_tiles:
            folium.TileLayer(
                tiles=target_tiles,
                attr='GEE / Sentinel-2',
                name=f'🎯 Target — {end_year}',
                overlay=True, control=True, show=False, opacity=0.9
            ).add_to(m_overlay)

        all_features_ov = (
            list((st.session_state.construction_geojson or {}).get('features', [])) +
            list((st.session_state.demolition_geojson   or {}).get('features', []))
        )
        if all_features_ov:
            merged_fc_ov = {'type': 'FeatureCollection', 'features': all_features_ov}
            STYLE_MAP_OV = {
                'construction': {'fillColor': '#ef4444', 'color': '#b91c1c'},
                'demolition':   {'fillColor': '#3b82f6', 'color': '#1d4ed8'},
            }
            def _change_style_ov(feature):
                ctype = (feature.get('properties') or {}).get('change_type', 'construction')
                base  = STYLE_MAP_OV.get(ctype, STYLE_MAP_OV['construction'])
                return {**base, 'weight': 1.8, 'fillOpacity': 0.58}

            folium.GeoJson(
                merged_fc_ov,
                name='🔴🔵 Change Detection',
                style_function=_change_style_ov,
                overlay=True, control=True, show=True,
                tooltip=folium.GeoJsonTooltip(
                    fields=['change_type'],
                    aliases=['Change type:'],
                    style="font-family:monospace;font-size:12px;background:#0c0f1a;color:#e2e8f0;"
                )
            ).add_to(m_overlay)

        folium.GeoJson(
            {"type": "Feature", "geometry": st.session_state.saved_aoi_geojson},
            name='📐 AOI Boundary',
            style_function=lambda _: {
                'color': '#38bdf8', 'weight': 2, 'fillOpacity': 0, 'dashArray': '6 4'
            },
            overlay=True, control=True, show=True
        ).add_to(m_overlay)

        folium.LayerControl(collapsed=False, position='topright').add_to(m_overlay)
        st_folium(m_overlay, width="100%", height=560,
                  key="unified_overlay_map", returned_objects=[])

# =====================================================================
# 7. RUN BUTTON (in sidebar)
# =====================================================================
if st.session_state.saved_aoi_geojson is not None:
    st.sidebar.markdown("---")
    st.sidebar.success("✅ AOI captured — ready to process")
    run_analysis = st.sidebar.button("🚀 Run Change Detection", use_container_width=True)

    # ─────────────────────────────────────────────────────────────────
    # MAIN PROCESSING PIPELINE  (unchanged logic)
    # ─────────────────────────────────────────────────────────────────
    if run_analysis:
        with st.spinner("Computing multi-index ensemble… this may take 30–60 s"):
            try:
                active_roi = ee.Geometry(st.session_state.saved_aoi_geojson)

                img_baseline = ee.Image(get_seasonal_composite(active_roi, start_year)).clip(active_roi)
                img_target   = ee.Image(get_seasonal_composite(active_roi, end_year)).clip(active_roi)

                idx_base   = compute_indices(img_baseline)
                idx_target = compute_indices(img_target)

                ndbi_base  = idx_base.select('NDBI');   ndbi_tgt  = idx_target.select('NDBI')
                ndvi_base  = idx_base.select('NDVI');   ndvi_tgt  = idx_target.select('NDVI')
                mndwi_base = idx_base.select('MNDWI');  mndwi_tgt = idx_target.select('MNDWI')
                bsi_base   = idx_base.select('BSI');    bsi_tgt   = idx_target.select('BSI')

                d_ndbi  = ndbi_tgt.subtract(ndbi_base)
                d_ndvi  = ndvi_tgt.subtract(ndvi_base)
                d_mndwi = mndwi_tgt.subtract(mndwi_base)
                d_bsi   = bsi_tgt.subtract(bsi_base)

                not_vegetation = ndvi_tgt.lt(ndvi_veg_thresh)
                not_water      = mndwi_tgt.lt(0.15)

                vote_ndbi  = d_ndbi.gt(construction_thresh)
                vote_ndvi  = d_ndvi.lt(-construction_thresh * 0.7)
                vote_mndwi = d_mndwi.lt(-construction_thresh * 0.5)
                vote_bsi   = d_bsi.gt(construction_thresh * 0.6)

                ensemble_score   = vote_ndbi.add(vote_ndvi).add(vote_mndwi).add(vote_bsi)
                construction_raw = (ensemble_score.gte(ensemble_votes)
                                    .And(not_vegetation).And(not_water))
                demolition_raw   = (d_ndbi.lt(demolition_thresh)
                                    .And(d_ndvi.gt(-demolition_thresh * 0.4))
                                    .And(not_water))

                construction_clean = lightweight_noise_filter(
                    construction_raw.unmask(0), min_patch_pixels).rename('construction')
                demolition_clean   = lightweight_noise_filter(
                    demolition_raw.unmask(0),   min_patch_pixels).rename('demolition')

                total_change_raw   = construction_raw.Or(demolition_raw).unmask(0)
                total_change_clean = lightweight_noise_filter(total_change_raw, min_patch_pixels)
                predicted_raster   = total_change_clean.rename('predicted')

                wc_urban = get_worldcover_urban(active_roi)
                gt_spectral = (d_ndbi.abs().gt(0.02)
                               .And(img_target.select('B11').gt(0.05)))
                if wc_urban is not None:
                    ground_truth = (gt_spectral
                                    .And(wc_urban.eq(1).Or(d_ndbi.abs().gt(0.08)))
                                    .unmask(0).rename('actual'))
                else:
                    gt_any = (d_ndbi.abs().gt(0.03)
                              .Or(d_bsi.abs().gt(0.025))
                              .Or(d_ndvi.abs().gt(0.05)))
                    ground_truth = (gt_spectral.And(gt_any).unmask(0).rename('actual'))

                pixel_area         = ee.Image.pixelArea()
                predicted_named    = predicted_raster.rename('predicted')
                ground_truth_named = ground_truth.rename('actual')
                RR = dict(geometry=active_roi, scale=10, maxPixels=1e10, tileScale=4)

                total_detected_area = (predicted_named.gt(0).rename('area')
                                       .multiply(pixel_area)
                                       .reduceRegion(reducer=ee.Reducer.sum(), **RR)
                                       .get('area'))
                wrong_area = (predicted_named.eq(1).And(ground_truth_named.eq(0)).rename('fp')
                              .multiply(pixel_area)
                              .reduceRegion(reducer=ee.Reducer.sum(), **RR).get('fp'))
                undetected_area = (predicted_named.eq(0).And(ground_truth_named.eq(1)).rename('fn')
                                   .multiply(pixel_area)
                                   .reduceRegion(reducer=ee.Reducer.sum(), **RR).get('fn'))

                tp_c = float(predicted_named.eq(1).And(ground_truth_named.eq(1)).rename('tp')
                             .reduceRegion(reducer=ee.Reducer.sum(), **RR).getInfo().get('tp', 0) or 0)
                tn_c = float(predicted_named.eq(0).And(ground_truth_named.eq(0)).rename('tn')
                             .reduceRegion(reducer=ee.Reducer.sum(), **RR).getInfo().get('tn', 0) or 0)
                fp_c = float(predicted_named.eq(1).And(ground_truth_named.eq(0)).rename('fp')
                             .reduceRegion(reducer=ee.Reducer.sum(), **RR).getInfo().get('fp', 0) or 0)
                fn_c = float(predicted_named.eq(0).And(ground_truth_named.eq(1)).rename('fn')
                             .reduceRegion(reducer=ee.Reducer.sum(), **RR).getInfo().get('fn', 0) or 0)
                total_c = float(predicted_named.gte(0).rename('total')
                                .reduceRegion(reducer=ee.Reducer.sum(), **RR).getInfo().get('total', 1) or 1)

                accuracy_score = max(0.0, min(1.0, (tp_c + tn_c) / total_c if total_c > 0 else 0.0))
                precision      = tp_c / (tp_c + fp_c) if (tp_c + fp_c) > 0 else 0.0
                recall         = tp_c / (tp_c + fn_c) if (tp_c + fn_c) > 0 else 0.0
                f1_score       = (2 * precision * recall / (precision + recall)
                                  if (precision + recall) > 0 else 0.0)

                area_detected_ha   = round(float(ee.Number(total_detected_area or 0).divide(10000).getInfo()), 2)
                area_wrong_ha      = round(float(ee.Number(wrong_area      or 0).divide(10000).getInfo()), 2)
                area_undetected_ha = round(float(ee.Number(undetected_area or 0).divide(10000).getInfo()), 2)

                _con_sum = (construction_clean.gt(0).rename('a')
                            .multiply(pixel_area)
                            .reduceRegion(reducer=ee.Reducer.sum(), **RR)
                            .get('a'))
                _dem_sum = (demolition_clean.gt(0).rename('a')
                            .multiply(pixel_area)
                            .reduceRegion(reducer=ee.Reducer.sum(), **RR)
                            .get('a'))
                construction_area_ha = round(float(ee.Number(_con_sum or 0).divide(10000).getInfo()), 2)
                demolition_area_ha   = round(float(ee.Number(_dem_sum or 0).divide(10000).getInfo()), 2)

                st.session_state.metrics = {
                    "accuracy": round(accuracy_score * 100, 2),
                    "precision": round(precision * 100, 2),
                    "recall": round(recall * 100, 2),
                    "f1": round(f1_score * 100, 2),
                    "total_area_ha": area_detected_ha,
                    "construction_area_ha": construction_area_ha,
                    "demolition_area_ha": demolition_area_ha,
                    "wrong_area_ha": area_wrong_ha,
                    "undetected_area_ha": area_undetected_ha,
                    "tp": int(tp_c), "tn": int(tn_c), "fp": int(fp_c), "fn": int(fn_c),
                }

                geotiff_url = predicted_raster.updateMask(predicted_raster.gt(0)).getDownloadURL({
                    'scale': 10, 'crs': 'EPSG:4326', 'region': active_roi, 'format': 'GEO_TIFF'
                })
                st.session_state.raster_download_url = geotiff_url

                # Vectorize CONSTRUCTION
                construction_vectors = (
                    construction_clean.updateMask(construction_clean.gt(0))
                    .reduceToVectors(
                        geometry=active_roi, scale=10, geometryType='polygon',
                        eightConnected=True, labelProperty='class',
                        maxPixels=1e10, tileScale=4,
                    )
                )
                construction_geojson = construction_vectors.getInfo()
                for feat in construction_geojson.get('features', []):
                    feat.setdefault('properties', {})['change_type'] = 'construction'
                st.session_state.construction_geojson = construction_geojson

                # Vectorize DEMOLITION
                demolition_vectors = (
                    demolition_clean.updateMask(demolition_clean.gt(0))
                    .reduceToVectors(
                        geometry=active_roi, scale=10, geometryType='polygon',
                        eightConnected=True, labelProperty='class',
                        maxPixels=1e10, tileScale=4,
                    )
                )
                demolition_geojson = demolition_vectors.getInfo()
                for feat in demolition_geojson.get('features', []):
                    feat.setdefault('properties', {})['change_type'] = 'demolition'
                st.session_state.demolition_geojson = demolition_geojson

                merged_features = (
                    construction_geojson.get('features', []) +
                    demolition_geojson.get('features', [])
                )
                st.session_state.detected_geojson = {
                    'type': 'FeatureCollection', 'features': merged_features
                }
                st.sidebar.success("✅ Analysis complete!")
                st.rerun()

            except Exception as spatial_error:
                st.sidebar.error(f"Processing error: {spatial_error}")

else:
    if st.session_state.detected_geojson is None:
        st.markdown("""
        <div class="instruction-box">
          <strong>How to use:</strong> Click the <strong>rectangle tool</strong> in the map toolbar (top-left),
          draw a box over your area of interest — the <strong>swipe comparison</strong> will load automatically,
          then click <strong>Run Change Detection</strong> in the sidebar.
          Start with a small area (&lt; 5 km²) for fastest results.
        </div>
        """, unsafe_allow_html=True)

# =====================================================================
# 8. RESULTS DISPLAY  (unchanged)
# =====================================================================
if st.session_state.detected_geojson is not None:
    st.markdown('<div class="scan-divider"></div>', unsafe_allow_html=True)

    if st.session_state.metrics:
        m = st.session_state.metrics

        st.markdown("### 📊 Detection Performance")
        c1, c2, c3, c4 = st.columns(4)
        with c1: st.metric("Overall Accuracy", f"{m['accuracy']}%")
        with c2: st.metric("Precision",        f"{m['precision']}%",
                            help="Of flagged pixels, how many truly changed?")
        with c3: st.metric("Recall",           f"{m['recall']}%",
                            help="Of truly changed pixels, how many were caught?")
        with c4: st.metric("F1 Score",         f"{m['f1']}%",
                            help="Harmonic mean of Precision and Recall.")

        st.markdown("### 📐 Area & Confusion Matrix")
        a1, a2, a3, a4, a5, a6 = st.columns(6)
        with a1: st.metric("🔴 Construction",  f"{m.get('construction_area_ha', 0)} ha")
        with a2: st.metric("🔵 Demolition",    f"{m.get('demolition_area_ha', 0)} ha")
        with a3: st.metric("False Alarm Area", f"{m['wrong_area_ha']} ha")
        with a4: st.metric("True Positives",   f"{m['tp']:,} px")
        with a5: st.metric("False Positives",  f"{m['fp']:,} px")
        with a6: st.metric("False Negatives",  f"{m['fn']:,} px")

    n_construction = len((st.session_state.construction_geojson or {}).get('features', []))
    n_demolition   = len((st.session_state.demolition_geojson   or {}).get('features', []))
    st.markdown(f"""
    <div style="display:flex;gap:1.5rem;align-items:center;
         padding:0.65rem 1rem;margin-bottom:0.8rem;
         background:var(--bg-card);border:1px solid var(--border);
         border-radius:var(--radius);font-family:'Space Mono',monospace;
         font-size:0.72rem;letter-spacing:0.05em;">
      <span style="display:flex;align-items:center;gap:0.5rem;">
        <span style="display:inline-block;width:14px;height:14px;border-radius:3px;
               background:rgba(239,68,68,0.55);border:2px solid #ef4444;"></span>
        <span style="color:var(--text-2);">CONSTRUCTION</span>
        <span style="color:#ef4444;font-weight:700;">{n_construction} polygons</span>
      </span>
      <span style="color:var(--text-3);">|</span>
      <span style="display:flex;align-items:center;gap:0.5rem;">
        <span style="display:inline-block;width:14px;height:14px;border-radius:3px;
               background:rgba(59,130,246,0.55);border:2px solid #3b82f6;"></span>
        <span style="color:var(--text-2);">DEMOLITION</span>
        <span style="color:#3b82f6;font-weight:700;">{n_demolition} polygons</span>
      </span>
      <span style="color:var(--text-3);">|</span>
      <span style="color:var(--accent);font-size:0.68rem;">
        ↑ Use the layer checkboxes in the <strong>Imagery &amp; Change Overlay</strong> map above.
      </span>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("### 💾 Export")
    col1, col2 = st.columns(2)
    with col1:
        st.download_button(
            label="📥 Download GeoJSON Vector",
            data=json.dumps(st.session_state.detected_geojson, indent=2),
            file_name=f"change_{start_year}_to_{end_year}.geojson",
            mime="application/geo+json",
            use_container_width=True
        )
    with col2:
        if st.session_state.raster_download_url:
            try:
                r = requests.get(st.session_state.raster_download_url, timeout=60)
                st.download_button(
                    label="📥 Download GeoTIFF Raster",
                    data=r.content,
                    file_name=f"change_raster_{start_year}_to_{end_year}.tif",
                    mime="image/tiff",
                    use_container_width=True
                )
            except Exception as dl_err:
                st.error(f"GeoTIFF fetch failed: {dl_err}")

    with st.expander("💡 Tuning guide"):
        st.markdown("""
**Nothing detected (0 ha)?**
- Set *Ensemble Votes* to **1**
- Lower *Construction Threshold* to `0.02`
- Lower *Min Patch Size* to `1`
- Raise *Vegetation Mask NDVI* to `0.50`
- Use a wider time gap, e.g. 2019 → 2024

**Too many false alarms (low Precision)?**
- Raise *Ensemble Votes* to 2 or 3
- Raise *Min Patch Size* to 4–6

**Missing real changes (low Recall)?**
- Lower *Ensemble Votes* to 1
- Lower *Construction Threshold*
- Lower *Min Patch Size* to 1

**General tips:**
- Longer gaps (e.g. 2018 → 2024) = stronger spectral contrast
- Smaller, focused AOIs = better cloud-free composites
        """)