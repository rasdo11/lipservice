#!/usr/bin/env python3
"""
Lip Service — Issue Generator
Reads the system prompt, calls Claude, renders HTML, updates issues.json.

Required env vars:
  ANTHROPIC_API_KEY  — Anthropic API key
  ISSUE_NUMBER       — Issue number (integer)
  BRIEF              — Weekly editorial brief (pasted text)
"""

import datetime
import json
import os
import re
import sys
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
    background: #E8E8E4;
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

  /* ── ROTATION ── */
  .rotation {
    background: var(--light);
    padding: 28px 40px;
  }

  .rotation-kicker {
    font-size: 9px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--mid);
    font-weight: 400;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .rotation-kicker::after {
    content: 'SPONSORED';
    font-size: 8px;
    letter-spacing: 2px;
    border: 1px solid var(--rule);
    padding: 2px 6px;
    color: var(--mid);
  }

  .rotation-item {
    font-size: 14px;
    line-height: 1.7;
    color: #444440;
    font-weight: 300;
    padding: 12px 0;
    border-bottom: 1px solid var(--rule);
  }

  .rotation-item:first-of-type { padding-top: 0; }
  .rotation-item:last-of-type { border-bottom: none; padding-bottom: 0; }
  .rotation-item a { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }

  .rotation-note {
    margin-top: 14px;
    font-size: 11px;
    font-style: normal;
    color: #AAAAAA;
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

  <!-- ROTATION 1 -->
  <div class="rotation">
    <div class="rotation-kicker">In Our Rotation</div>
    {{ROTATION_1}}
    <div class="rotation-note">Keep scrolling&hellip;more recs below</div>
  </div>

  <!-- PUT IT IN YOUR MOUTH -->
  <div class="sec">
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

  <!-- ROTATION 2 -->
  <div class="rotation">
    <div class="rotation-kicker">In Our Rotation</div>
    {{ROTATION_2}}
    <div class="rotation-note"><em>We only feature things we&#8217;d actually use on our own face. Or inject into it.</em></div>
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
        <a href="../unsubscribe.html">Unsubscribe</a>
      </div>
      <div class="footer-copy">Weekly &middot; Free forever &middot; &copy; 2026</div>
    </div>
  </div>

</div>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# Rendering helpers
# ---------------------------------------------------------------------------

def md_bold(text: str) -> str:
    """Convert **bold** markdown to <strong> HTML."""
    return re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)


def body_to_html(text: str) -> str:
    """Split body text into <p> tags, applying bold conversion."""
    paragraphs = [p.strip() for p in text.strip().split('\n\n') if p.strip()]
    if not paragraphs:
        return ''
    return '\n'.join(f'<p>{md_bold(p)}</p>' for p in paragraphs)


def render_related(anchor_text: str, pub: str) -> str:
    """Render the Related link block. Skips pub span if empty."""
    if not anchor_text:
        return ''
    pub_span = f' <span class="related-pub">*({pub})*</span>' if pub else ''
    return (
        f'<div class="related">Related: '
        f'<a href="#">{anchor_text}</a>{pub_span}</div>'
    )


def render_rotation(items: list) -> str:
    parts = []
    for item in items:
        text = item.get('text', '')
        parts.append(f'    <div class="rotation-item">{text}</div>')
    return '\n'.join(parts)


def render_lips_in_6(items: list) -> str:
    parts = []
    for item in items:
        emoji = item.get('emoji', '')
        text = item.get('text', '')
        parts.append(
            f'    <div class="lip6-item">'
            f'<span class="lip6-emoji">{emoji}</span>'
            f'<span class="lip6-text">{text}</span>'
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
            text_html = f'<a href="{url}">{text}</a>'
        else:
            text_html = text

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
    parts = []
    for item in items:
        emoji = item.get('emoji', '')
        text = item.get('text', '')
        parts.append(
            f'    <div class="cal-item">'
            f'<span class="cal-emoji">{emoji}</span>'
            f'<span class="cal-text">{text}</span>'
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
        f'    <div class="opening-body">{opening_note}</div>\n'
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
# Main
# ---------------------------------------------------------------------------

def main():
    # Read env vars
    api_key = os.environ.get('ANTHROPIC_API_KEY', '').strip()
    issue_number_str = os.environ.get('ISSUE_NUMBER', '').strip()
    brief = os.environ.get('BRIEF', '').strip()

    if not api_key:
        print('ERROR: ANTHROPIC_API_KEY is not set.', file=sys.stderr)
        sys.exit(1)
    if not issue_number_str:
        print('ERROR: ISSUE_NUMBER is not set.', file=sys.stderr)
        sys.exit(1)
    if not brief:
        print('ERROR: BRIEF is not set.', file=sys.stderr)
        sys.exit(1)

    try:
        issue_number = int(issue_number_str)
    except ValueError:
        print(f'ERROR: ISSUE_NUMBER must be an integer, got: {issue_number_str}', file=sys.stderr)
        sys.exit(1)

    # Paths
    repo_root = Path(__file__).parent.parent.parent
    system_prompt_path = repo_root / '.github' / 'prompts' / 'system.md'
    issues_dir = repo_root / 'issues'
    issues_json_path = repo_root / 'issues.json'

    # Read system prompt
    if not system_prompt_path.exists():
        print(f'ERROR: System prompt not found at {system_prompt_path}', file=sys.stderr)
        sys.exit(1)
    system_prompt = system_prompt_path.read_text(encoding='utf-8')

    # Call Anthropic API
    client = anthropic.Anthropic(api_key=api_key)
    user_message = f'Write issue {issue_number}.\n\n{brief}'

    print(f'Calling Claude API for issue {issue_number}...')
    response = client.messages.create(
        model='claude-opus-4-5',
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
    rotation_1 = data.get('rotation_1', [])
    rotation_2 = data.get('rotation_2', [])
    quick_hits = data.get('quick_hits', [])
    calendar = data.get('on_our_calendar', [])

    last_word = data.get('last_word', {})
    lw_quote = last_word.get('quote', '')
    lw_attr = last_word.get('attribution', '')

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

    html = html.replace('{{ROTATION_1}}', render_rotation(rotation_1))

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
    html = html.replace('{{ROTATION_2}}', render_rotation(rotation_2))

    html = html.replace('{{LAST_WORD_QUOTE}}', lw_quote)
    html = html.replace('{{LAST_WORD_ATTR}}', lw_attr)

    # Save issue HTML
    issues_dir.mkdir(exist_ok=True)
    issue_path = issues_dir / f'{slug}.html'
    issue_path.write_text(html, encoding='utf-8')

    # Update issues.json
    if issues_json_path.exists():
        try:
            issues = json.loads(issues_json_path.read_text(encoding='utf-8'))
        except (json.JSONDecodeError, ValueError):
            issues = []
    else:
        issues = []

    # Remove any existing entry for this issue number
    issues = [e for e in issues if e.get('issue') != issue_number]

    new_entry = {
        'issue': issue_number,
        'date': issue_date_iso,
        'title': title,
        'preview': preview,
        'email_subject': email_subject,
        'slug': slug,
        'url': f'./issues/{slug}.html',
    }

    # Prepend new entry
    issues.insert(0, new_entry)
    issues_json_path.write_text(
        json.dumps(issues, indent=2, ensure_ascii=False),
        encoding='utf-8',
    )

    # Write title to GitHub Actions output (if running in Actions)
    github_output = os.environ.get('GITHUB_OUTPUT', '')
    if github_output:
        with open(github_output, 'a', encoding='utf-8') as f:
            f.write(f'ISSUE_TITLE={title}\n')

    print(f'✓ Issue {issue_number}: {title}')
    print(f'  Saved: {issue_path}')
    print(f'  Slug:  {slug}')
    print(f'  Date:  {issue_date_iso}')


if __name__ == '__main__':
    main()
