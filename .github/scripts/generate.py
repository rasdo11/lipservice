#!/usr/bin/env python3
"""
Lip Service — Issue Generator
Reads the system prompt, calls Claude, renders HTML, saves the issue.

Required env vars:
  ANTHROPIC_API_KEY       — Anthropic API key

Optional env vars:
  ISSUE_NUMBER            — Issue number (auto-detects if blank)
  BRIEF                   — Editorial brief (generates freely if blank)
  MODE                    — 'preview' or 'immediate' (default: immediate)
                            preview  → save to preview/, create MailerLite draft
                            immediate → save to issues/, update issues.json now
  MAILERLITE_API_KEY      — Required for preview mode MailerLite draft creation
  MAILERLITE_FROM_NAME    — Sender display name (default: Lip Service)
  MAILERLITE_FROM_EMAIL   — Sender email address (must be verified in MailerLite)
"""

import datetime
import json
import os
import re
import shutil
import sys
import urllib.error
import urllib.request
from pathlib import Path

import anthropic

# ---------------------------------------------------------------------------
# HTML TEMPLATE (design-a-v2.html embedded)
# Uses {{PLACEHOLDER}} tokens replaced via str.replace() — NOT str.format()
# so CSS curly braces are safe.
# ---------------------------------------------------------------------------
TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Lip Service — {{PAGE_TITLE}}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --black: #0A0A0A;
    --white: #FFFFFF;
    --paper: #FAFAF8;
    --accent: #B8341B;
    --accent2: #1B4B8A;
    --mid: #555550;
    --rule: #DDDDD8;
    --light: #F2F2EE;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: #FFFFFF;
    font-family: 'Outfit', sans-serif;
    font-size: 15px;
    line-height: 1.65;
    color: var(--black);
    -webkit-font-smoothing: antialiased;
  }

  .shell {
    max-width: 600px;
    margin: 0 auto;
    background: var(--white);
  }

  /* ── MASTHEAD ── */
  .mast {
    padding: 40px 40px 0;
    border-bottom: 1px solid var(--black);
  }

  .mast-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 20px;
  }

  .mast-eyebrow {
    font-family: 'Outfit', sans-serif;
    font-size: 9px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--mid);
    font-weight: 400;
  }

  .mast-meta {
    font-size: 9px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--mid);
    font-weight: 400;
  }

  .mast-logo {
    font-family: 'Cormorant Garamond', serif;
    font-size: 72px;
    font-weight: 300;
    letter-spacing: -3px;
    line-height: 0.9;
    color: var(--black);
    margin-bottom: 16px;
    font-style: normal;
  }

  .mast-logo em {
    font-style: normal;
    font-weight: 300;
  }

  .mast-rule-row {
    display: flex;
    align-items: center;
    gap: 0;
    margin-bottom: 0;
  }

  .mast-tagline {
    font-size: 10px;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: var(--mid);
    font-weight: 400;
    padding: 12px 0;
    flex: 1;
  }

  .mast-issue {
    font-family: 'Outfit', sans-serif;
    font-size: 11px;
    font-style: normal;
    color: var(--mid);
    padding: 12px 0;
    font-weight: 400;
    letter-spacing: 1px;
  }

  /* ── BUT FIRST ── */
  .but-first {
    background: var(--accent);
    padding: 16px 40px;
    font-size: 13px;
    color: rgba(255,255,255,0.9);
    font-weight: 300;
    letter-spacing: 0.2px;
  }

  .but-first strong {
    font-weight: 600;
    color: #fff;
    letter-spacing: 0.5px;
    margin-right: 6px;
  }

  /* ── OPENING NOTE ── */
  .opening {
    padding: 32px 40px 32px;
  }

  .opening-body {
    font-family: 'Cormorant Garamond', serif;
    font-size: 21px;
    font-weight: 400;
    font-style: normal;
    line-height: 1.6;
    color: var(--black);
    margin-bottom: 14px;
  }

  .opening-kicker {
    font-size: 9px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--accent);
    font-weight: 500;
    margin-bottom: 10px;
  }

  .opening-sig {
    font-size: 11px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--mid);
    font-weight: 400;
    font-style: normal;
  }

  /* ── QUOTE OF DAY ── */
  .qotd {
    background: var(--light);
    padding: 24px 40px;
    border-bottom: 1px solid var(--black);
  }

  .qotd-kicker {
    font-size: 9px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--accent);
    font-weight: 500;
    margin-bottom: 10px;
  }

  .qotd-text {
    font-family: 'Cormorant Garamond', serif;
    font-size: 22px;
    font-style: normal;
    font-weight: 500;
    color: var(--black);
    line-height: 1.45;
    margin-bottom: 8px;
  }

  .qotd-attr {
    font-size: 12px;
    color: var(--mid);
    font-weight: 300;
    font-style: normal;
  }

  /* ── SECTIONS ── */
  .sec {
    padding: 36px 40px;
  }

  .sec-cat {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }

  .sec-cat-label {
    font-size: 9px;
    letter-spacing: 3px;
    text-transform: uppercase;
    font-weight: 500;
    color: var(--accent);
  }

  .sec-cat-rule {
    flex: 1;
    height: 1px;
    background: var(--rule);
  }

  .sec-hed {
    font-family: 'Cormorant Garamond', serif;
    font-size: 28px;
    font-weight: 500;
    line-height: 1.15;
    letter-spacing: -0.5px;
    color: var(--black);
    margin-bottom: 18px;
  }

  .sec-hed em {
    font-style: normal;
    color: var(--accent);
  }

  .body {
    font-size: 14.5px;
    line-height: 1.8;
    color: #333330;
    font-weight: 300;
  }

  .body p { margin-bottom: 12px; }
  .body p:last-child { margin-bottom: 0; }

  .body strong {
    font-weight: 500;
    color: var(--black);
  }

  .callout {
    border-top: 2px solid var(--black);
    padding: 16px 0;
    margin: 20px 0;
    font-family: 'Cormorant Garamond', serif;
    font-size: 18px;
    font-style: normal;
    font-weight: 500;
    line-height: 1.5;
    color: var(--black);
  }

  .related {
    margin-top: 16px;
    font-size: 12px;
    color: var(--mid);
    font-weight: 300;
  }

  .related a {
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 3px;
    font-weight: 400;
  }

  .related-pub {
    font-style: normal;
    color: var(--mid);
  }

  /* ── DEALS BOX ── */
  .deals {
    background: var(--light);
    padding: 28px 40px;
    text-align: center;
  }

  .deals-icon { font-size: 28px; margin-bottom: 10px; }

  .deals-hed {
    font-family: 'Cormorant Garamond', serif;
    font-size: 22px;
    font-weight: 400;
    color: var(--black);
    margin-bottom: 8px;
  }

  .deals-sub {
    font-size: 13px;
    color: var(--mid);
    font-weight: 300;
    line-height: 1.6;
    margin-bottom: 18px;
    max-width: 380px;
    margin-left: auto;
    margin-right: auto;
  }

  .deals-btn {
    display: inline-block;
    background: var(--accent);
    color: #FFFFFF;
    font-size: 10px;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    font-weight: 500;
    padding: 12px 28px;
    text-decoration: none;
  }

  .deals-fine {
    font-size: 10px;
    color: #AAAAAA;
    margin-top: 12px;
  }

  /* ── PIYM IMAGE ── */
  .piym-image {
    width: 100%;
    overflow: hidden;
  }

  .piym-image img {
    width: 100%;
    height: 200px;
    object-fit: cover;
    display: block;
  }

  /* ── CHEAT MEAL ── */
  .cheat {
    margin: 18px 0;
    padding: 14px 18px;
    border-left: 3px solid var(--accent);
    background: rgba(184,52,27,0.04);
  }

  .cheat-kicker {
    font-size: 9px;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: var(--accent);
    font-weight: 500;
    margin-bottom: 6px;
  }

  .cheat-text {
    font-size: 14px;
    color: #333330;
    font-weight: 300;
    line-height: 1.6;
  }

  /* ── LIPS IN 6 ── */
  .lip6-item {
    display: flex;
    gap: 14px;
    padding: 12px 0;
    border-bottom: 1px solid var(--rule);
    align-items: flex-start;
  }

  .lip6-item:first-child { padding-top: 0; }
  .lip6-item:last-child { border-bottom: none; padding-bottom: 0; }

  .lip6-emoji { font-size: 15px; flex-shrink: 0; margin-top: 2px; }

  .lip6-text {
    font-size: 14px;
    color: #333330;
    font-weight: 300;
    line-height: 1.65;
  }

  .lip6-text a { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }

  /* ── QUICK HITS ── */
  .qh-item {
    display: flex;
    gap: 14px;
    padding: 13px 0;
    border-bottom: 1px solid var(--rule);
    align-items: flex-start;
  }

  .qh-item:first-child { padding-top: 0; }
  .qh-item:last-child { border-bottom: none; padding-bottom: 0; }
  .qh-emoji { font-size: 15px; flex-shrink: 0; margin-top: 2px; }

  .qh-text {
    font-size: 14.5px;
    color: #333330;
    font-weight: 300;
    line-height: 1.65;
  }

  .qh-text strong { font-weight: 500; color: var(--black); }
  .qh-text a { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }

  /* ── CALENDAR ── */
  .cal-item {
    display: flex;
    gap: 14px;
    padding: 10px 0;
    border-bottom: 1px solid var(--rule);
    align-items: flex-start;
  }

  .cal-item:first-child { padding-top: 0; }
  .cal-item:last-child { border-bottom: none; padding-bottom: 0; }
  .cal-emoji { font-size: 14px; flex-shrink: 0; margin-top: 2px; }
  .cal-text { font-size: 14px; color: #333330; font-weight: 300; line-height: 1.6; }
  .cal-text a { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }

  .cal-intro {
    font-size: 11px;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-style: normal;
    color: var(--mid);
    margin-bottom: 14px;
    font-weight: 400;
  }

  /* ── LAST WORD ── */
  .last-word {
    padding: 40px 40px;
    background: var(--black);
    border-top: 3px solid var(--accent);
  }

  .lw-kicker {
    font-size: 9px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--accent);
    font-weight: 500;
    margin-bottom: 20px;
  }

  .lw-quote {
    font-family: 'Cormorant Garamond', serif;
    font-size: 32px;
    font-weight: 400;
    font-style: normal;
    color: var(--white);
    line-height: 1.3;
    letter-spacing: -0.5px;
    margin-bottom: 16px;
  }

  .lw-attr {
    font-size: 12px;
    color: rgba(255,255,255,0.35);
    font-weight: 300;
    font-style: normal;
    letter-spacing: 0.3px;
  }

  /* ── FOOTER ── */
  .footer {
    background: var(--paper);
    border-top: 1px solid var(--black);
    padding: 28px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-logo {
    font-family: 'Cormorant Garamond', serif;
    font-size: 20px;
    font-weight: 300;
    font-style: italic;
    color: var(--black);
  }

  .footer-right {
    text-align: right;
  }

  .footer-links {
    display: flex;
    gap: 16px;
    justify-content: flex-end;
    margin-bottom: 6px;
  }

  .footer-links a {
    font-size: 9px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--mid);
    text-decoration: none;
  }

  .footer-copy {
    font-size: 10px;
    color: #AAAAAA;
  }

  a { color: var(--accent); }
</style>
</head>
<body>
<div class="shell">

  <!-- MASTHEAD -->
  <div class="mast">
    <div class="mast-top">
      <div class="mast-eyebrow">Health &amp; Beauty · Est. 2020</div>
      <div class="mast-meta">{{ISSUE_LABEL}} · {{ISSUE_DAYOFWEEK}}</div>
    </div>
    <div class="mast-logo">Lip Service</div>
    <div class="mast-rule-row">
      <div class="mast-tagline">Everything that touches your lips</div>
      <div class="mast-issue">{{ISSUE_DATE}}</div>
    </div>
  </div>

  <!-- BUT FIRST -->
  <div class="but-first">
    <strong>But first:</strong> {{BUT_FIRST}}
  </div>

  <!-- OPENING NOTE -->
{{OPENING_SECTION}}

  <!-- QUOTE OF DAY -->
  <div class="qotd">
    <div class="qotd-kicker">Quote of the Day</div>
    <div class="qotd-text">&#8220;{{QUOTE_TEXT}}&#8221;</div>
    <div class="qotd-attr">{{QUOTE_ATTR}}</div>
  </div>

  <!-- INJECTION REPORT -->
  <div class="sec">
    <div class="sec-cat">
      <div class="sec-cat-label">The Injection Report</div>
      <div class="sec-cat-rule"></div>
    </div>
    <div class="sec-hed">{{INJECTION_HEADLINE}}</div>
    <div class="body">
      {{INJECTION_BODY}}
    </div>
    <div class="callout">{{INJECTION_HIGHLIGHT}}</div>
    {{INJECTION_RELATED}}
  </div>

  <!-- DEALS -->
  <div class="deals">
    <div class="deals-icon">🎁</div>
    <div class="deals-hed">Lip Service Deals</div>
    <div class="deals-sub">Weekly deal codes and the chance to win a free beauty product in our monthly giveaway.</div>
    <a href="/subscribe.html" class="deals-btn">Get the Deals</a>
    <div class="deals-fine">Separate from this newsletter. No spam.</div>
  </div>

  <!-- PUT IT IN YOUR MOUTH -->
  <div class="sec">
    <div class="piym-image">
      <img src="https://images.unsplash.com/photo-{{PIYM_IMAGE_ID}}?w=600&auto=format&q=80" alt="{{PIYM_IMAGE_ALT}}" loading="lazy">
    </div>
    <div class="sec-cat">
      <div class="sec-cat-label">Put It In Your Mouth</div>
      <div class="sec-cat-rule"></div>
    </div>
    <div class="sec-hed">{{PIYM_HEADLINE}}</div>
    <div class="body">
      {{PIYM_BODY}}
    </div>
    <div class="cheat">
      <div class="cheat-kicker">This Week&#8217;s Cheat Meal</div>
      <div class="cheat-text">{{PIYM_CHEAT_MEAL}}</div>
    </div>
    <div class="callout">{{PIYM_HIGHLIGHT}}</div>
    {{PIYM_RELATED}}
  </div>

  <!-- LIP LAB -->
  <div class="sec">
    <div class="sec-cat">
      <div class="sec-cat-label">Lip Lab</div>
      <div class="sec-cat-rule"></div>
    </div>
    <div class="sec-hed">{{LIPLAB_HEADLINE}}</div>
    <div class="body">
      {{LIPLAB_BODY}}
    </div>
    <div class="callout">{{LIPLAB_HIGHLIGHT}}</div>
    {{LIPLAB_RELATED}}
  </div>

  <!-- LIPS IN 6 -->
  <div class="sec">
    <div class="sec-cat">
      <div class="sec-cat-label">The Lips in 6</div>
      <div class="sec-cat-rule"></div>
    </div>
    {{LIPS_IN_6}}
  </div>

  <!-- QUICK HITS -->
  <div class="sec">
    <div class="sec-cat">
      <div class="sec-cat-label">Quick Hits</div>
      <div class="sec-cat-rule"></div>
    </div>
    {{QUICK_HITS}}
  </div>

  <!-- CALENDAR -->
  <div class="sec">
    <div class="sec-cat">
      <div class="sec-cat-label">On Our Calendar</div>
      <div class="sec-cat-rule"></div>
    </div>
    <div class="cal-intro">A few things worth knowing this week&hellip;</div>
    {{CALENDAR}}
  </div>

  <!-- LAST WORD -->
  <div class="last-word">
    <div class="lw-kicker">Last Word</div>
    <div class="lw-quote">&#8220;{{LAST_WORD_QUOTE}}&#8221;</div>
    <div class="lw-attr">{{LAST_WORD_ATTR}}</div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-logo">Lip Service</div>
    <div class="footer-right">
      <div class="footer-links">
        <a href="../archive.html">Archive</a>
        <a href="../subscribe.html">Subscribe</a>
        <a href="../unsubscribe.html">Leave us</a>
      </div>
      <div class="footer-copy">Weekly &middot; Free forever &middot; &copy; 2026</div>
    </div>
  </div>

</div>
</body>
</html>
"""


# Curated wellness/food image pool — cycles by issue number
PIYM_IMAGES = [
    {'id': '1490645935967-10de6ba17061', 'alt': 'Fresh ingredients flatlay'},
    {'id': '1512621776951-a57ef59afbe4', 'alt': 'Colorful vegetables and superfoods'},
    {'id': '1490818702666-4da9b4e68a6e', 'alt': 'Healthy meal prep'},
    {'id': '1543362906-acfc16c67564', 'alt': 'Green smoothie bowl'},
    {'id': '1498837167922-ddd27525d352', 'alt': 'Fresh produce market'},
]


# ---------------------------------------------------------------------------
# Rendering helpers
# ---------------------------------------------------------------------------

def md_bold(text: str) -> str:
    """Convert **bold** markdown to <strong> HTML."""
    return re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)


def clean_text(text: str) -> str:
    """Strip em dashes and Markdown horizontal-rule markers."""
    text = re.sub(r'\s*\u2014\s*', ' ', text)  # em dash → space
    text = re.sub(r'^[-*_]{3,}\s*$', '', text, flags=re.MULTILINE)  # --- *** ___
    return text.strip()


def body_to_html(text: str) -> str:
    """Split body text into <p> tags, applying em-dash strip and bold conversion."""
    paragraphs = [p.strip() for p in clean_text(text).split('\n\n') if p.strip()]
    if not paragraphs:
        return ''
    return '\n'.join(f'<p>{md_bold(p)}</p>' for p in paragraphs)


def render_related(anchor_text: str, pub: str) -> str:
    """Render the Related link block. Skips pub span if empty."""
    if not anchor_text:
        return ''
    pub_span = f' <span class="related-pub">({pub})</span>' if pub else ''
    return (
        f'<div class="related">Related: '
        f'<a href="#">{anchor_text}</a>{pub_span}</div>'
    )


def render_lips_in_6(items: list) -> str:
    parts = []
    for item in items:
        emoji = item.get('emoji', '')
        text = md_bold(item.get('text', ''))
        url = item.get('url', '')
        text_html = f'<a href="{url}">{text}</a>' if url else text
        parts.append(
            f'    <div class="lip6-item">'
            f'<span class="lip6-emoji">{emoji}</span>'
            f'<span class="lip6-text">{text_html}</span>'
            f'</div>'
        )
    return '\n'.join(parts)


def render_quick_hits(items: list) -> str:
    parts = []
    for item in items:
        emoji = item.get('emoji', '')
        label = item.get('label')
        text = item.get('text', '')
        url = item.get('url')

        if url:
            text_html = f'<a href="{url}">{md_bold(text)}</a>'
        else:
            text_html = md_bold(text)

        if label:
            inner = f'<strong>{label}:</strong> {text_html}'
        else:
            inner = text_html

        parts.append(
            f'    <div class="qh-item">'
            f'<span class="qh-emoji">{emoji}</span>'
            f'<span class="qh-text">{inner}</span>'
            f'</div>'
        )
    return '\n'.join(parts)


def render_calendar(items: list) -> str:
    """Render calendar items — only items with a URL are included."""
    parts = []
    for item in items:
        url = item.get('url', '')
        if not url:
            continue
        emoji = item.get('emoji', '')
        text = md_bold(item.get('text', ''))
        parts.append(
            f'    <div class="cal-item">'
            f'<span class="cal-emoji">{emoji}</span>'
            f'<span class="cal-text"><a href="{url}">{text}</a></span>'
            f'</div>'
        )
    return '\n'.join(parts)


def render_opening_section(opening_note: str) -> str:
    """Render opening note block, or empty string if no content."""
    if not opening_note.strip():
        return ''
    return (
        '  <div class="opening">\n'
        '    <div class="opening-kicker">A note from the editor</div>\n'
        f'    <div class="opening-body">{md_bold(opening_note)}</div>\n'
        '  </div>\n'
    )


# ---------------------------------------------------------------------------
# JSON extraction
# ---------------------------------------------------------------------------

def extract_json(raw: str) -> dict:
    """Strip markdown fences if present and parse JSON."""
    text = raw.strip()
    # Remove ```json ... ``` or ``` ... ``` wrappers
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        print(f'ERROR: Could not parse API response as JSON.\n{e}', file=sys.stderr)
        print(f'Raw response (first 500 chars):\n{raw[:500]}', file=sys.stderr)
        sys.exit(1)


# ---------------------------------------------------------------------------
# Email HTML — CSS var map and conversion
# ---------------------------------------------------------------------------

_CSS_VARS = {
    'var(--black)':  '#0A0A0A',
    'var(--white)':  '#FFFFFF',
    'var(--paper)':  '#FAFAF8',
    'var(--accent)': '#B8341B',
    'var(--accent2)':'#1B4B8A',
    'var(--mid)':    '#555550',
    'var(--rule)':   '#DDDDD8',
    'var(--light)':  '#F2F2EE',
}

# Selectors whose display:flex / gap must be stripped for Gmail
_FLEX_SELECTORS = [
    '.mast-top', '.mast-rule-row', '.sec-cat',
    '.lip6-item', '.qh-item', '.cal-item',
    '.footer',
]


def _fix_style_block(match: re.Match) -> str:
    style = match.group(1)
    for sel in _FLEX_SELECTORS:
        sel_esc = re.escape(sel)
        style = re.sub(
            rf'({sel_esc}\s*\{{[^}}]*?)(\s*display:\s*flex\s*;)',
            r'\1', style, flags=re.DOTALL,
        )
        style = re.sub(
            rf'({sel_esc}\s*\{{[^}}]*?)(\s*gap:[^;]+;)',
            r'\1', style, flags=re.DOTALL,
        )
        style = re.sub(
            rf'({sel_esc}\s*\{{[^}}]*?)(\s*align-items:[^;]+;)',
            r'\1', style, flags=re.DOTALL,
        )
    return f'<style>{style}</style>'


def make_email_html(html: str) -> str:
    """Convert web HTML to email-safe HTML (for MailerLite / Gmail compatibility)."""

    # 1. Replace CSS custom properties
    for var, value in _CSS_VARS.items():
        html = html.replace(var, value)

    # 2. Remove :root block (all vars now inlined)
    html = re.sub(r'\s*:root\s*\{[^}]+\}', '', html)

    # 3. Font-stack fallbacks
    html = html.replace(
        "'Cormorant Garamond', serif",
        "'Cormorant Garamond', Georgia, serif",
    )
    html = html.replace(
        "'Outfit', sans-serif",
        "'Outfit', -apple-system, system-ui, sans-serif",
    )

    # 4. Strip display:flex / gap / align-items from the style block
    html = re.sub(r'<style>(.*?)</style>', _fix_style_block, html, flags=re.DOTALL)

    # 5. .lip6-item  →  table
    html = re.sub(
        r'<div class="lip6-item">'
        r'<span class="lip6-emoji">(.*?)</span>'
        r'<span class="lip6-text">([\s\S]*?)</span>'
        r'</div>',
        lambda m: (
            '<table width="100%" cellpadding="0" cellspacing="0" border="0"'
            ' style="border-bottom:1px solid #DDDDD8;padding:12px 0">'
            '<tr>'
            f'<td width="28" valign="top" style="font-size:15px;padding-right:14px;'
            f'padding-top:2px;white-space:nowrap">{m.group(1)}</td>'
            f'<td style="font-size:14px;color:#333330;font-weight:300;'
            f'line-height:1.65">{m.group(2)}</td>'
            '</tr></table>'
        ),
        html,
    )

    # 6. .qh-item  →  table
    html = re.sub(
        r'<div class="qh-item">'
        r'<span class="qh-emoji">(.*?)</span>'
        r'<span class="qh-text">([\s\S]*?)</span>'
        r'</div>',
        lambda m: (
            '<table width="100%" cellpadding="0" cellspacing="0" border="0"'
            ' style="border-bottom:1px solid #DDDDD8;padding:13px 0">'
            '<tr>'
            f'<td width="28" valign="top" style="font-size:15px;padding-right:14px;'
            f'padding-top:2px;white-space:nowrap">{m.group(1)}</td>'
            f'<td style="font-size:14.5px;color:#333330;font-weight:300;'
            f'line-height:1.65">{m.group(2)}</td>'
            '</tr></table>'
        ),
        html,
    )

    # 7. .cal-item  →  table
    html = re.sub(
        r'<div class="cal-item">'
        r'<span class="cal-emoji">(.*?)</span>'
        r'<span class="cal-text">([\s\S]*?)</span>'
        r'</div>',
        lambda m: (
            '<table width="100%" cellpadding="0" cellspacing="0" border="0"'
            ' style="border-bottom:1px solid #DDDDD8;padding:10px 0">'
            '<tr>'
            f'<td width="26" valign="top" style="font-size:14px;padding-right:14px;'
            f'padding-top:2px;white-space:nowrap">{m.group(1)}</td>'
            f'<td style="font-size:14px;color:#333330;font-weight:300;'
            f'line-height:1.6">{m.group(2)}</td>'
            '</tr></table>'
        ),
        html,
    )

    # 8. .mast-top  →  table
    html = re.sub(
        r'<div class="mast-top">\s*'
        r'<div class="mast-eyebrow">(.*?)</div>\s*'
        r'<div class="mast-meta">(.*?)</div>\s*'
        r'</div>',
        lambda m: (
            '<table width="100%" cellpadding="0" cellspacing="0" border="0"'
            ' style="margin-bottom:20px"><tr>'
            f'<td style="font-size:9px;letter-spacing:3px;text-transform:uppercase;'
            f'color:#555550;font-weight:400">{m.group(1)}</td>'
            f'<td align="right" style="font-size:9px;letter-spacing:2px;'
            f'text-transform:uppercase;color:#555550;font-weight:400">{m.group(2)}</td>'
            '</tr></table>'
        ),
        html, flags=re.DOTALL,
    )

    # 9. .mast-rule-row  →  table
    html = re.sub(
        r'<div class="mast-rule-row">\s*'
        r'<div class="mast-tagline">(.*?)</div>\s*'
        r'<div class="mast-issue">(.*?)</div>\s*'
        r'</div>',
        lambda m: (
            '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
            f'<td style="font-size:10px;letter-spacing:2.5px;text-transform:uppercase;'
            f'color:#555550;font-weight:400;padding:12px 0">{m.group(1)}</td>'
            f'<td align="right" style="font-size:11px;color:#555550;font-weight:400;'
            f'letter-spacing:1px;padding:12px 0">{m.group(2)}</td>'
            '</tr></table>'
        ),
        html, flags=re.DOTALL,
    )

    # 10. .sec-cat  →  table (label + rule line)
    html = re.sub(
        r'<div class="sec-cat">\s*'
        r'<div class="sec-cat-label">(.*?)</div>\s*'
        r'<div class="sec-cat-rule"></div>\s*'
        r'</div>',
        lambda m: (
            '<table width="100%" cellpadding="0" cellspacing="0" border="0"'
            ' style="margin-bottom:14px"><tr>'
            f'<td style="font-size:9px;letter-spacing:3px;text-transform:uppercase;'
            f'font-weight:500;color:#B8341B;white-space:nowrap;padding-right:10px">'
            f'{m.group(1)}</td>'
            '<td style="border-top:1px solid #DDDDD8;width:100%">&nbsp;</td>'
            '</tr></table>'
        ),
        html, flags=re.DOTALL,
    )

    # 11. .footer  →  table
    html = re.sub(
        r'<div class="footer">\s*'
        r'<div class="footer-logo">(.*?)</div>\s*'
        r'<div class="footer-right">([\s\S]*?)</div>\s*'
        r'</div>',
        lambda m: (
            '<table width="100%" cellpadding="0" cellspacing="0" border="0"'
            ' style="background:#FAFAF8;border-top:1px solid #0A0A0A;padding:28px 40px"><tr>'
            f'<td style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:20px;'
            f'font-weight:300;font-style:italic;color:#0A0A0A">{m.group(1)}</td>'
            f'<td align="right">{m.group(2)}</td>'
            '</tr></table>'
        ),
        html, flags=re.DOTALL,
    )

    # 12. .piym-image img → add email-safe inline width (object-fit not supported)
    html = re.sub(
        r'<div class="piym-image">\s*'
        r'(<img [^>]+>)\s*'
        r'</div>',
        lambda m: (
            '<div style="width:100%;margin-bottom:20px">'
            + re.sub(
                r'(<img)',
                r'\1 width="600" style="width:100%;height:200px;display:block"',
                m.group(1),
            )
            + '</div>'
        ),
        html,
    )

    # 13. .deals  →  email-safe centered table
    html = re.sub(
        r'<div class="deals">[\s\S]*?</div>\s*\n',
        (
            '<table width="100%" cellpadding="0" cellspacing="0" border="0"'
            ' style="background:#F2F2EE;padding:28px 40px;text-align:center">'
            '<tr><td align="center">'
            '<p style="font-size:28px;margin:0 0 10px">🎁</p>'
            '<p style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:22px;'
            'font-weight:400;color:#0A0A0A;margin:0 0 8px">Lip Service Deals</p>'
            '<p style="font-size:13px;color:#555550;font-weight:300;line-height:1.6;'
            'margin:0 0 18px">Weekly deal codes and the chance to win a free beauty product '
            'in our monthly giveaway.</p>'
            '<a href="/subscribe.html" style="display:inline-block;background:#B8341B;'
            'color:#FFFFFF;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;'
            'font-weight:500;padding:12px 28px;text-decoration:none">Get the Deals</a>'
            '<p style="font-size:10px;color:#AAAAAA;margin:12px 0 0">'
            'Separate from this newsletter. No spam.</p>'
            '</td></tr></table>\n'
        ),
        html,
    )

    return html


# ---------------------------------------------------------------------------
# MailerLite API
# ---------------------------------------------------------------------------

def _save_email_fallback(email_html: str, path: Path) -> None:
    """Save email HTML to a local file when the API call fails."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(email_html, encoding='utf-8')
    print(f'📄 Email HTML saved locally as fallback: {path}', file=sys.stderr)


def create_mailerlite_campaign(
    api_key: str,
    from_name: str,
    from_email: str,
    title: str,
    email_subject: str,
    email_html: str,
    issue_number: int,
    fallback_path: Path,
) -> None:
    """Create a MailerLite draft campaign for manual review and send."""
    subject = email_subject or title
    nnn = f'{issue_number:03d}'
    campaign_name = f'Lip Service #{nnn} \u2014 {title}'

    payload = json.dumps({
        'name': campaign_name,
        'type': 'regular',
        'emails': [{
            'subject': subject,
            'from_name': from_name,
            'from': from_email,
            'content': email_html,
        }],
    }).encode('utf-8')

    req = urllib.request.Request(
        'https://connect.mailerlite.com/api/campaigns',
        data=payload,
        method='POST',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
    )

    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        print(f'⚠️  MAILERLITE WARNING: HTTP {e.code} — {body[:400]}', file=sys.stderr)
        _save_email_fallback(email_html, fallback_path)
        return
    except urllib.error.URLError as e:
        print(f'⚠️  MAILERLITE WARNING: {e.reason}', file=sys.stderr)
        _save_email_fallback(email_html, fallback_path)
        return

    campaign_id = result.get('data', {}).get('id', 'unknown')

    print('\n' + '━' * 50)
    print('MAILERLITE DRAFT CREATED')
    print('━' * 50)
    print(f'Issue:    #{nnn}')
    print(f'Subject:  {subject}')
    print(f'Edit URL: https://dashboard.mailerlite.com/campaigns/{campaign_id}/edit')
    print('Review in MailerLite, then Send when ready.')
    print('━' * 50 + '\n')


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # Read env vars
    api_key = os.environ.get('ANTHROPIC_API_KEY', '').strip()
    issue_number_str = os.environ.get('ISSUE_NUMBER', '').strip()
    brief = os.environ.get('BRIEF', '').strip()
    mode = os.environ.get('MODE', 'immediate').strip().lower()
    mailerlite_api_key = os.environ.get('MAILERLITE_API_KEY', '').strip()
    mailerlite_from_name = os.environ.get('MAILERLITE_FROM_NAME', 'Lip Service').strip()
    mailerlite_from_email = os.environ.get('MAILERLITE_FROM_EMAIL', '').strip()

    if mode not in ('preview', 'immediate'):
        print(f'ERROR: MODE must be "preview" or "immediate", got: {mode}', file=sys.stderr)
        sys.exit(1)

    if not api_key:
        print('ERROR: ANTHROPIC_API_KEY is not set.', file=sys.stderr)
        sys.exit(1)

    # Paths
    repo_root = Path(__file__).parent.parent.parent
    system_prompt_path = repo_root / '.github' / 'prompts' / 'system.md'
    issues_dir = repo_root / 'issues'
    issues_json_path = repo_root / 'issues.json'

    # Auto-detect issue number if not provided
    if issue_number_str:
        try:
            issue_number = int(issue_number_str)
        except ValueError:
            print(f'ERROR: ISSUE_NUMBER must be an integer, got: {issue_number_str}', file=sys.stderr)
            sys.exit(1)
    else:
        # Derive next issue number from issues.json
        if issues_json_path.exists():
            try:
                existing = json.loads(issues_json_path.read_text(encoding='utf-8'))
                max_issue = max((e.get('issue', 0) for e in existing), default=0)
                issue_number = max_issue + 1
            except (json.JSONDecodeError, ValueError):
                issue_number = 1
        else:
            issue_number = 1
        print(f'Auto-detected issue number: {issue_number}')

    # Read system prompt
    if not system_prompt_path.exists():
        print(f'ERROR: System prompt not found at {system_prompt_path}', file=sys.stderr)
        sys.exit(1)
    system_prompt = system_prompt_path.read_text(encoding='utf-8')

    # Call Anthropic API
    client = anthropic.Anthropic(api_key=api_key)

    # Build user message — brief is optional
    rules = (
        'IMPORTANT: Never use an em dash (\u2014) anywhere. Rewrite any sentence that would need one. '
        'Never use --- or *** or ___ as dividers.'
    )
    if brief:
        user_message = f'Write issue {issue_number}.\n\n{rules}\n\n{brief}'
    else:
        user_message = f'Write issue {issue_number}.\n\n{rules}'

    print(f'Calling Claude API for issue {issue_number}...')
    response = client.messages.create(
        model='claude-opus-4-6',
        max_tokens=4096,
        system=system_prompt,
        messages=[{'role': 'user', 'content': user_message}],
    )
    raw = response.content[0].text

    # Parse JSON
    data = extract_json(raw)

    # Extract fields with defensive defaults
    title = data.get('title', f'Issue {issue_number}')
    preview = data.get('preview', '')
    email_subject = data.get('email_subject', '')
    but_first = data.get('but_first', '')
    opening_note = data.get('opening_note', '')

    qotd = data.get('quote_of_day', {})
    quote_text = qotd.get('text', '')
    quote_attr = qotd.get('attribution', '')

    inj = data.get('injection_report', {})
    inj_headline = inj.get('headline', '')
    inj_body = inj.get('body', '')
    inj_highlight = inj.get('highlight', '')
    inj_related = inj.get('related', '')
    inj_related_pub = inj.get('related_pub', '')

    piym = data.get('put_it_in_your_mouth', {})
    piym_headline = piym.get('headline', '')
    piym_body = piym.get('body', '')
    piym_highlight = piym.get('highlight', '')
    piym_cheat_meal = piym.get('cheat_meal', '')
    piym_related = piym.get('related', '')
    piym_related_pub = piym.get('related_pub', '')

    lab = data.get('lip_lab', {})
    lab_headline = lab.get('headline', '')
    lab_body = lab.get('body', '')
    lab_highlight = lab.get('highlight', '')
    lab_related = lab.get('related', '')
    lab_related_pub = lab.get('related_pub', '')

    lips_in_6 = data.get('lips_in_6', [])
    quick_hits = data.get('quick_hits', [])
    calendar = data.get('on_our_calendar', [])

    last_word = data.get('last_word', {})
    lw_quote = last_word.get('quote', '')
    lw_attr = last_word.get('attribution', '')

    piym_img = PIYM_IMAGES[issue_number % len(PIYM_IMAGES)]

    # Date/label helpers
    today = datetime.date.today()
    issue_date_display = today.strftime('%B %-d, %Y')   # e.g. "April 1, 2026"
    issue_date_iso = today.isoformat()                   # e.g. "2026-04-01"
    day_of_week = today.strftime('%A')                   # e.g. "Friday"
    nnn = f'{issue_number:03d}'
    slug = f'issue-{nnn}'
    issue_label = f'Issue No. {nnn}'

    # Render template substitutions
    html = TEMPLATE
    html = html.replace('{{PAGE_TITLE}}', title)
    html = html.replace('{{ISSUE_LABEL}}', issue_label)
    html = html.replace('{{ISSUE_DAYOFWEEK}}', day_of_week)
    html = html.replace('{{ISSUE_DATE}}', issue_date_display)
    html = html.replace('{{BUT_FIRST}}', but_first)
    html = html.replace('{{OPENING_SECTION}}', render_opening_section(opening_note))
    html = html.replace('{{QUOTE_TEXT}}', quote_text)
    html = html.replace('{{QUOTE_ATTR}}', quote_attr)

    html = html.replace('{{INJECTION_HEADLINE}}', inj_headline)
    html = html.replace('{{INJECTION_BODY}}', body_to_html(inj_body))
    html = html.replace('{{INJECTION_HIGHLIGHT}}', md_bold(inj_highlight))
    html = html.replace('{{INJECTION_RELATED}}', render_related(inj_related, inj_related_pub))

    html = html.replace('{{PIYM_IMAGE_ID}}', piym_img['id'])
    html = html.replace('{{PIYM_IMAGE_ALT}}', piym_img['alt'])
    html = html.replace('{{PIYM_HEADLINE}}', piym_headline)
    html = html.replace('{{PIYM_BODY}}', body_to_html(piym_body))
    html = html.replace('{{PIYM_HIGHLIGHT}}', md_bold(piym_highlight))
    html = html.replace('{{PIYM_CHEAT_MEAL}}', md_bold(piym_cheat_meal))
    html = html.replace('{{PIYM_RELATED}}', render_related(piym_related, piym_related_pub))

    html = html.replace('{{LIPLAB_HEADLINE}}', lab_headline)
    html = html.replace('{{LIPLAB_BODY}}', body_to_html(lab_body))
    html = html.replace('{{LIPLAB_HIGHLIGHT}}', md_bold(lab_highlight))
    html = html.replace('{{LIPLAB_RELATED}}', render_related(lab_related, lab_related_pub))

    html = html.replace('{{LIPS_IN_6}}', render_lips_in_6(lips_in_6))
    html = html.replace('{{QUICK_HITS}}', render_quick_hits(quick_hits))
    html = html.replace('{{CALENDAR}}', render_calendar(calendar))

    html = html.replace('{{LAST_WORD_QUOTE}}', lw_quote)
    html = html.replace('{{LAST_WORD_ATTR}}', lw_attr)

    new_entry = {
        'issue': issue_number,
        'date': issue_date_iso,
        'title': title,
        'preview': preview,
        'email_subject': email_subject,
        'slug': slug,
        'url': f'./issues/{slug}.html',
    }

    if mode == 'preview':
        # --- PREVIEW MODE ---
        preview_dir = repo_root / 'preview'
        preview_dir.mkdir(exist_ok=True)

        meta_path = preview_dir / 'meta.json'
        if meta_path.exists():
            try:
                existing_meta = json.loads(meta_path.read_text(encoding='utf-8'))
                print(
                    f'⚠️  WARNING: preview/meta.json already exists '
                    f'(Issue #{existing_meta.get("issue")} — {existing_meta.get("title")})\n'
                    '   Overwriting with new generation.'
                )
            except (json.JSONDecodeError, ValueError):
                pass

        issue_path = preview_dir / f'{slug}.html'
        html = clean_text(html)
        issue_path.write_text(html, encoding='utf-8')

        meta_path.write_text(
            json.dumps(new_entry, indent=2, ensure_ascii=False),
            encoding='utf-8',
        )

        print(f'✓ Preview saved: {issue_path}')
        print(f'  Slug:  {slug}')
        print(f'  Date:  {issue_date_iso}')

        # Build email HTML and create MailerLite draft campaign
        email_html = make_email_html(html)
        fallback_path = issue_path.parent / f'{slug}-email.html'

        if mailerlite_api_key and mailerlite_from_email:
            create_mailerlite_campaign(
                api_key=mailerlite_api_key,
                from_name=mailerlite_from_name,
                from_email=mailerlite_from_email,
                title=title,
                email_subject=email_subject,
                email_html=email_html,
                issue_number=issue_number,
                fallback_path=fallback_path,
            )
        else:
            print('ℹ️  MAILERLITE_API_KEY / MAILERLITE_FROM_EMAIL not set — skipping MailerLite.')
            _save_email_fallback(email_html, fallback_path)

    else:
        # --- IMMEDIATE MODE ---
        issues_dir.mkdir(exist_ok=True)
        issue_path = issues_dir / f'{slug}.html'
        html = clean_text(html)
        issue_path.write_text(html, encoding='utf-8')

        if issues_json_path.exists():
            try:
                issues = json.loads(issues_json_path.read_text(encoding='utf-8'))
            except (json.JSONDecodeError, ValueError):
                issues = []
        else:
            issues = []

        issues = [e for e in issues if e.get('issue') != issue_number]
        issues.insert(0, new_entry)
        issues_json_path.write_text(
            json.dumps(issues, indent=2, ensure_ascii=False),
            encoding='utf-8',
        )

        index_path = repo_root / 'index.html'
        shutil.copy2(issue_path, index_path)
        newsletter_path = repo_root / 'newsletter.html'
        shutil.copy2(issue_path, newsletter_path)

        print(f'✓ Issue {issue_number}: {title}')
        print(f'  Saved: {issue_path}')
        print(f'  Slug:  {slug}')
        print(f'  Date:  {issue_date_iso}')
        print(f'  index.html + newsletter.html updated')

    # Write GitHub Actions outputs
    github_output = os.environ.get('GITHUB_OUTPUT', '')
    if github_output:
        with open(github_output, 'a', encoding='utf-8') as f:
            f.write(f'ISSUE_TITLE={title}\n')
            f.write(f'ISSUE_NUMBER={issue_number}\n')


if __name__ == '__main__':
    main()
