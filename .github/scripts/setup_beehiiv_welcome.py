#!/usr/bin/env python3
"""
Lip Service — Beehiiv Welcome Automation Setup
Run ONCE to create a welcome email automation for new subscribers.

Usage:
    BEEHIIV_API_KEY=... BEEHIIV_PUBLICATION_ID=... python .github/scripts/setup_beehiiv_welcome.py

DO NOT re-run unless you want duplicate automations.
To verify: log into beehiiv → Automations → confirm "Welcome" automation is active.
"""

import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path


SITE_URL = os.environ.get('SITE_URL', 'https://lipservice-psi.vercel.app')


def get_latest_issue_url() -> str:
    """Read issues.json to find the most recent published issue URL."""
    repo_root = Path(__file__).parent.parent.parent
    issues_json_path = repo_root / 'issues.json'

    if issues_json_path.exists():
        try:
            issues = json.loads(issues_json_path.read_text(encoding='utf-8'))
            if issues:
                slug = issues[0].get('slug', '')
                if slug:
                    return f'{SITE_URL}/issues/{slug}.html'
        except (json.JSONDecodeError, ValueError):
            pass

    return f'{SITE_URL}'


def build_welcome_email_html(latest_issue_url: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body {{
    margin: 0;
    padding: 0;
    background-color: #FAFAF8;
    font-family: 'Outfit', -apple-system, system-ui, sans-serif;
    color: #0A0A0A;
  }}
  .wrapper {{
    max-width: 640px;
    margin: 0 auto;
    padding: 48px 32px;
    background-color: #FFFFFF;
  }}
  .masthead {{
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #0A0A0A;
    margin-bottom: 32px;
    padding-bottom: 16px;
    border-bottom: 2px solid #0A0A0A;
  }}
  .body {{
    font-size: 16px;
    line-height: 1.6;
    color: #0A0A0A;
    margin-bottom: 24px;
  }}
  .body p {{
    margin: 0 0 16px 0;
  }}
  .cta {{
    display: inline-block;
    background-color: #B8341B;
    color: #FFFFFF;
    font-family: 'Outfit', -apple-system, system-ui, sans-serif;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-decoration: none;
    padding: 12px 24px;
    margin: 8px 0 32px;
  }}
  .sign-off {{
    font-size: 14px;
    color: #555550;
    border-top: 1px solid #DDDDD8;
    padding-top: 24px;
    margin-top: 32px;
  }}
</style>
</head>
<body>
<div class="wrapper">
  <div class="masthead">Lip Service</div>

  <div class="body">
    <p><strong>You're in.</strong></p>

    <p>Lip Service lands every Tuesday and Saturday — health, beauty, injectables, food,
    lip products, and one video guaranteed to wreck your mascara.</p>

    <p>No guilt, no dumbing down, no pretending there's one right answer.</p>

    <p>Here's the latest issue:</p>
  </div>

  <a href="{latest_issue_url}" class="cta">Read the latest issue →</a>

  <div class="sign-off">
    See you Tuesday. — Lip Service
  </div>
</div>
</body>
</html>"""


def create_welcome_automation(api_key: str, pub_id: str, latest_issue_url: str) -> None:
    email_html = build_welcome_email_html(latest_issue_url)

    # Build automation payload
    # beehiiv automations: trigger on new subscriber, send welcome email
    payload = {
        "name": "Welcome to Lip Service",
        "trigger": {
            "type": "subscriber_created"
        },
        "steps": [
            {
                "type": "email",
                "delay": 0,
                "email": {
                    "subject": "welcome to lip service",
                    "content_html": email_html,
                    "preview_text": "You're in. Lip Service lands every Tuesday and Saturday."
                }
            }
        ],
        "status": "active"
    }

    data = json.dumps(payload).encode('utf-8')
    url = f'https://api.beehiiv.com/v2/publications/{pub_id}/automations'

    req = urllib.request.Request(
        url,
        data=data,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )

    try:
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        print(f'ERROR: beehiiv API returned HTTP {e.code}', file=sys.stderr)
        print(f'Response: {error_body}', file=sys.stderr)
        print('\nNote: beehiiv free tier may not support automation creation via API.', file=sys.stderr)
        print('If so, create the welcome email manually in beehiiv → Automations.', file=sys.stderr)
        sys.exit(1)

    automation = body.get('data', body)
    automation_id = automation.get('id', 'unknown')
    status = automation.get('status', 'unknown')

    print('━' * 52)
    print('BEEHIIV WELCOME AUTOMATION CREATED')
    print('━' * 52)
    print(f'Automation ID: {automation_id}')
    print(f'Status:        {status}')
    print(f'Latest issue:  {latest_issue_url}')
    print()
    print('To run this script:')
    print('  BEEHIIV_API_KEY=... BEEHIIV_PUBLICATION_ID=... \\')
    print('  python .github/scripts/setup_beehiiv_welcome.py')
    print()
    print('Run this ONCE. Do not re-run unless you want duplicate automations.')
    print('To verify: log into beehiiv → Automations → confirm "Welcome" automation is active.')
    print('━' * 52)


def main():
    api_key = os.environ.get('BEEHIIV_API_KEY', '')
    pub_id = os.environ.get('BEEHIIV_PUBLICATION_ID', '')

    if not api_key or not pub_id:
        print('ERROR: BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID must be set.', file=sys.stderr)
        print('Usage: BEEHIIV_API_KEY=... BEEHIIV_PUBLICATION_ID=... python setup_beehiiv_welcome.py')
        sys.exit(1)

    latest_issue_url = get_latest_issue_url()
    print(f'Latest issue URL: {latest_issue_url}')

    create_welcome_automation(api_key, pub_id, latest_issue_url)


if __name__ == '__main__':
    main()
