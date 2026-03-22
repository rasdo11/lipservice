import anthropic
import json
import os
import datetime
from pathlib import Path

ISSUE_NUMBER = int(os.environ["ISSUE_NUMBER"])
BRIEF = os.environ["BRIEF"]

# ── Read system prompt ────────────────────────────────────────────
with open(".github/prompts/system.md", "r") as f:
    SYSTEM_PROMPT = f.read()

# ── Call the API ──────────────────────────────────────────────────
client = anthropic.Anthropic()

message = client.messages.create(
    model="claude-opus-4-5",
    max_tokens=4096,
    system=SYSTEM_PROMPT,
    messages=[
        {"role": "user", "content": f"Write issue {ISSUE_NUMBER}.\n\n{BRIEF}"}
    ]
)

raw = message.content[0].text.strip()

# Strip backticks if Claude adds them anyway
if raw.startswith("```"):
    raw = raw.split("\n", 1)[1]
if raw.endswith("```"):
    raw = raw.rsplit("```", 1)[0]

data = json.loads(raw)

# ── Build issue HTML ──────────────────────────────────────────────
slug = f"issue-{ISSUE_NUMBER:03d}"
issue_date = datetime.date.today()

quick_hits_html = "".join([
    f"""
    <div class="gossip-item">
      <div class="gossip-headline">{item['headline']}</div>
      <div class="gossip-body">{item['body']}</div>
    </div>
    """
    for item in data["quick_hits"]
])

lips_in_6_html = "".join([
    f"""
    <div class="lips6-item">
      <div class="lips6-number">{i + 1}</div>
      <div class="lips6-text">{item}</div>
    </div>
    """
    for i, item in enumerate(data["lips_in_6"])
])

calendar_html = "".join([
    f"""
    <div class="cal-item">
      <div class="cal-date">{item['date']}</div>
      <div class="cal-event">{item['event']}</div>
    </div>
    """
    for item in data["on_our_calendar"]
])

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Lip Service — {data['title']}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700;1,900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300;1,9..40,400&display=swap" rel="stylesheet">
<style>
  :root {{
    --cream: #FAF7F2; --ink: #1A1410; --blush: #E8C4B8;
    --rouge: #C94040; --nude: #D4A898; --charcoal: #3D3530;
    --warm-gray: #9A8F89; --divider: #E2DAD3;
  }}
  *, *::before, *::after {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ background:var(--cream); font-family:'DM Sans',sans-serif; color:var(--ink); font-size:16px; line-height:1.7; -webkit-font-smoothing:antialiased; }}
  .wrapper {{ max-width:600px; margin:0 auto; background:var(--cream); }}
  /* HEADER */
  .header {{ background:var(--ink); padding:28px 24px 20px; text-align:center; position:relative; overflow:hidden; }}
  .header::before {{ content:''; position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg,var(--rouge),var(--nude),var(--blush)); }}
  .masthead {{ font-family:'Playfair Display',serif; font-size:42px; font-weight:900; color:var(--cream); letter-spacing:-1px; line-height:1; margin-bottom:6px; }}
  .tagline {{ font-size:11px; font-weight:300; color:var(--nude); letter-spacing:3px; text-transform:uppercase; margin-bottom:16px; }}
  .header-meta {{ display:flex; justify-content:center; gap:20px; font-size:11px; color:var(--warm-gray); letter-spacing:1px; text-transform:uppercase; font-weight:400; padding-top:14px; border-top:1px solid rgba(255,255,255,0.1); }}
  /* HERO */
  .hero {{ background:var(--ink); padding:0 24px 32px; }}
  .hero-box {{ background:var(--rouge); padding:20px 22px; border-radius:2px; }}
  .hero-label {{ font-size:10px; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,0.7); margin-bottom:8px; font-weight:500; }}
  .hero-text {{ font-family:'Playfair Display',serif; font-size:20px; font-style:italic; color:#fff; line-height:1.4; font-weight:400; }}
  /* SECTIONS */
  .section {{ padding:36px 24px; border-bottom:1px solid var(--divider); }}
  .section:last-of-type {{ border-bottom:none; }}
  .section-label {{ display:inline-flex; align-items:center; gap:10px; margin-bottom:20px; }}
  .section-number {{ width:24px; height:24px; background:var(--ink); color:var(--cream); font-size:10px; font-weight:500; display:flex; align-items:center; justify-content:center; letter-spacing:0.5px; flex-shrink:0; border-radius:50%; }}
  .section-title {{ font-size:10px; font-weight:500; letter-spacing:3.5px; text-transform:uppercase; color:var(--rouge); }}
  .body-text {{ font-size:15.5px; line-height:1.75; color:var(--charcoal); font-weight:300; }}
  .body-text p {{ margin-bottom:14px; }}
  .body-text p:last-child {{ margin-bottom:0; }}
  .body-text strong {{ font-weight:500; color:var(--ink); }}
  /* DROP CAP */
  .drop-cap::first-letter {{ font-family:'Playfair Display',serif; font-size:58px; font-weight:900; line-height:0.8; float:left; margin-right:6px; margin-top:8px; color:var(--rouge); }}
  /* QUICK HITS */
  .gossip-item {{ padding:18px 0; border-bottom:1px solid var(--divider); }}
  .gossip-item:last-child {{ border-bottom:none; padding-bottom:0; }}
  .gossip-item:first-child {{ padding-top:0; }}
  .gossip-headline {{ font-family:'Playfair Display',serif; font-size:18px; font-weight:700; color:var(--ink); margin-bottom:8px; line-height:1.3; }}
  .gossip-body {{ font-size:14.5px; line-height:1.7; color:var(--charcoal); font-weight:300; }}
  /* LIPS IN 6 */
  .lips6-list {{ display:flex; flex-direction:column; gap:14px; }}
  .lips6-item {{ display:flex; gap:14px; align-items:flex-start; }}
  .lips6-number {{ font-family:'Playfair Display',serif; font-size:22px; font-weight:900; color:var(--rouge); line-height:1; flex-shrink:0; width:24px; }}
  .lips6-text {{ font-size:15px; line-height:1.65; color:var(--charcoal); font-weight:300; padding-top:2px; }}
  /* CALENDAR */
  .cal-list {{ display:flex; flex-direction:column; gap:0; }}
  .cal-item {{ display:flex; gap:16px; align-items:flex-start; padding:16px 0; border-bottom:1px solid var(--divider); }}
  .cal-item:last-child {{ border-bottom:none; padding-bottom:0; }}
  .cal-item:first-child {{ padding-top:0; }}
  .cal-date {{ font-size:10px; font-weight:500; letter-spacing:2px; text-transform:uppercase; color:var(--rouge); white-space:nowrap; padding-top:3px; min-width:64px; }}
  .cal-event {{ font-size:14.5px; line-height:1.65; color:var(--charcoal); font-weight:300; }}
  /* LAST WORD */
  .last-word-section {{ background:#F0EBE5; }}
  /* FOOTER */
  .footer {{ background:var(--ink); padding:28px 24px; text-align:center; border-top:3px solid var(--rouge); }}
  .footer-logo {{ font-family:'Playfair Display',serif; font-size:22px; font-weight:900; color:var(--cream); letter-spacing:-0.5px; margin-bottom:8px; }}
  .footer-text {{ font-size:12px; color:var(--warm-gray); line-height:1.6; margin-bottom:16px; font-weight:300; }}
  .footer-links {{ display:flex; justify-content:center; gap:20px; flex-wrap:wrap; }}
  .footer-links a {{ font-size:10px; color:var(--warm-gray); text-decoration:none; letter-spacing:2px; text-transform:uppercase; font-weight:400; }}
  .ornament {{ text-align:center; color:var(--rouge); font-size:18px; letter-spacing:8px; padding:8px 0 0; opacity:0.5; }}
  @media (max-width:480px) {{
    .masthead {{ font-size:36px; }}
    .section {{ padding:28px 20px; }}
    .hero {{ padding:0 20px 28px; }}
  }}
</style>
</head>
<body>
<div class="wrapper">

  <div class="header">
    <div class="masthead">Lip Service</div>
    <div class="tagline">The most fun a girl can have without taking her clothes off</div>
    <div class="header-meta">
      <span>Issue No. {ISSUE_NUMBER:03d}</span>
      <span>·</span>
      <span>{issue_date.strftime('%B %d, %Y')}</span>
    </div>
  </div>

  <div class="hero">
    <div class="hero-box">
      <div class="hero-label">This issue</div>
      <div class="hero-text">{data['preview']}</div>
    </div>
  </div>

  <!-- 01 INJECTION REPORT -->
  <div class="section">
    <div class="section-label">
      <div class="section-number">01</div>
      <div class="section-title">Injection Report</div>
    </div>
    <div class="body-text">
      <p class="drop-cap">{data['injection_report']}</p>
    </div>
    <div class="ornament">— ✦ —</div>
  </div>

  <!-- 02 PUT IT IN YOUR MOUTH -->
  <div class="section">
    <div class="section-label">
      <div class="section-number">02</div>
      <div class="section-title">Put It In Your Mouth</div>
    </div>
    <div class="body-text">
      <p>{data['put_it_in_your_mouth']}</p>
    </div>
  </div>

  <!-- 03 LIP LAB -->
  <div class="section">
    <div class="section-label">
      <div class="section-number">03</div>
      <div class="section-title">Lip Lab</div>
    </div>
    <div class="body-text">
      <p>{data['lip_lab']}</p>
    </div>
  </div>

  <!-- 04 LIPS IN 6 -->
  <div class="section">
    <div class="section-label">
      <div class="section-number">04</div>
      <div class="section-title">Lips in 6</div>
    </div>
    <div class="lips6-list">
      {lips_in_6_html}
    </div>
  </div>

  <!-- 05 QUICK HITS -->
  <div class="section">
    <div class="section-label">
      <div class="section-number">05</div>
      <div class="section-title">Quick Hits</div>
    </div>
    {quick_hits_html}
  </div>

  <!-- 06 ON OUR CALENDAR -->
  <div class="section">
    <div class="section-label">
      <div class="section-number">06</div>
      <div class="section-title">On Our Calendar</div>
    </div>
    <div class="cal-list">
      {calendar_html}
    </div>
  </div>

  <!-- 07 LAST WORD -->
  <div class="section last-word-section">
    <div class="section-label">
      <div class="section-number">07</div>
      <div class="section-title">Last Word</div>
    </div>
    <div class="body-text">
      <p>{data['last_word']}</p>
    </div>
  </div>

  <div class="footer">
    <div class="footer-logo">Lip Service</div>
    <div class="footer-text">
      Weekly beauty. No apologies.<br>
      <a href="../archive.html" style="color:var(--nude);">Archive</a> &nbsp;·&nbsp; <a href="../index.html" style="color:var(--nude);">Subscribe</a>
    </div>
    <div class="footer-links">
      <a href="#">View in browser</a>
      <a href="../archive.html">Archive</a>
      <a href="#">Unsubscribe</a>
    </div>
  </div>

</div>
</body>
</html>"""

# ── Save issue HTML ───────────────────────────────────────────────
Path("issues").mkdir(exist_ok=True)
with open(f"issues/{slug}.html", "w") as f:
    f.write(html)

print(f"✓ Saved issues/{slug}.html")

# ── Update issues.json ────────────────────────────────────────────
issues_path = Path("issues.json")
if issues_path.exists():
    with open(issues_path, "r") as f:
        issues = json.load(f)
else:
    issues = []

new_entry = {
    "issue": ISSUE_NUMBER,
    "date": str(issue_date),
    "title": data["title"],
    "preview": data["preview"],
    "sections": ["Injection Report", "Put It In Your Mouth", "Lip Lab", "Lips in 6", "Quick Hits", "On Our Calendar", "Last Word"],
    "slug": slug,
    "url": f"./issues/{slug}.html"
}

# Remove existing entry for this issue number if re-running
issues = [i for i in issues if i["issue"] != ISSUE_NUMBER]
issues.insert(0, new_entry)

with open(issues_path, "w") as f:
    json.dump(issues, f, indent=2)

print(f"✓ Updated issues.json — {len(issues)} total issues")
print(f"  Title: {data['title']}")
