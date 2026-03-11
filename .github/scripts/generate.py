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

hear_items = "".join([
    f"""
    <div class="hear-item">
      <div class="hear-headline">{item['headline']}</div>
      <p>{item['body']}</p>
    </div>
    """
    for item in data["did_you_hear"]
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
    --ink: #1A1410; --cream: #FAF7F2; --rouge: #C94040;
    --nude: #D4A898; --warm: #9A8880; --divider: #E4DBD4;
  }}
  *, *::before, *::after {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ background:#F0EBE3; font-family:'DM Sans',sans-serif; color:var(--ink); -webkit-font-smoothing:antialiased; }}
  .wrapper {{ max-width:600px; margin:0 auto; background:var(--cream); }}
  .header {{ background:var(--ink); padding:32px 40px; text-align:center; border-bottom:3px solid var(--rouge); }}
  .header-logo {{ font-family:'Playfair Display',serif; font-size:32px; font-weight:900; color:var(--cream); letter-spacing:-1px; }}
  .header-issue {{ font-size:10px; letter-spacing:3px; text-transform:uppercase; color:var(--nude); margin-top:6px; font-weight:400; }}
  .section {{ padding:36px 40px; border-bottom:1px solid var(--divider); }}
  .section-label {{ font-size:9px; letter-spacing:4px; text-transform:uppercase; color:var(--rouge); font-weight:500; margin-bottom:16px; display:flex; align-items:center; gap:10px; }}
  .section-label::after {{ content:''; flex:1; height:1px; background:var(--divider); }}
  .drop-cap::first-letter {{ font-family:'Playfair Display',serif; font-size:64px; font-weight:900; float:left; line-height:0.8; margin:6px 8px 0 0; color:var(--rouge); }}
  p {{ font-size:15px; line-height:1.75; color:var(--ink); margin-bottom:12px; font-weight:300; }}
  p:last-child {{ margin-bottom:0; }}
  .hear-item {{ margin-bottom:24px; padding-bottom:24px; border-bottom:1px solid var(--divider); }}
  .hear-item:last-child {{ margin-bottom:0; padding-bottom:0; border-bottom:none; }}
  .hear-headline {{ font-family:'Playfair Display',serif; font-size:17px; font-weight:700; color:var(--ink); margin-bottom:8px; line-height:1.2; }}
  .healthy-tears-link {{ display:block; margin-top:16px; padding:16px 20px; background:var(--ink); color:var(--cream); text-decoration:none; font-size:12px; letter-spacing:2px; text-transform:uppercase; text-align:center; font-weight:500; }}
  .footer {{ background:var(--ink); padding:32px 40px; text-align:center; }}
  .footer-logo {{ font-family:'Playfair Display',serif; font-size:20px; font-weight:900; color:var(--cream); margin-bottom:8px; }}
  .footer-text {{ font-size:11px; color:var(--warm); font-weight:300; line-height:1.6; }}
  .footer-text a {{ color:var(--nude); }}
  .back-link {{ display:block; text-align:center; padding:16px; font-size:11px; letter-spacing:2px; text-transform:uppercase; color:var(--warm); text-decoration:none; border-bottom:1px solid var(--divider); }}
  .back-link:hover {{ color:var(--rouge); }}
</style>
</head>
<body>
<div class="wrapper">
  <a class="back-link" href="../archive.html">← All Issues</a>
  <div class="header">
    <div class="header-logo">Lip Service</div>
    <div class="header-issue">Issue No. {ISSUE_NUMBER:03d} &nbsp;·&nbsp; {issue_date.strftime('%B %d, %Y')}</div>
  </div>

  <div class="section">
    <p class="drop-cap">{data['opening']}</p>
  </div>

  <div class="section">
    <div class="section-label">Did You Hear?</div>
    {hear_items}
  </div>

  <div class="section">
    <div class="section-label">Did You Know?</div>
    <p>{data['did_you_know']}</p>
  </div>

  <div class="section">
    <div class="section-label">Did You See?</div>
    <p>{data['did_you_see']}</p>
  </div>

  <div class="section" style="background:#F5EDE6;">
    <div class="section-label">Did You Help?</div>
    <p>{data['did_you_help']}</p>
  </div>

  <div class="section">
    <div class="section-label">Healthy Tears</div>
    <p>{data['healthy_tears']['context']}</p>
    <a class="healthy-tears-link" href="{data['healthy_tears']['url']}" target="_blank">Watch →</a>
  </div>

  <div class="footer">
    <div class="footer-logo">Lip Service</div>
    <div class="footer-text">
      Weekly beauty. No apologies.<br>
      <a href="../archive.html">Archive</a> &nbsp;·&nbsp; <a href="../index.html">Subscribe</a>
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
    "sections": ["Did You Hear?", "Did You Know?", "Did You See?", "Did You Help?", "Healthy Tears"],
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
