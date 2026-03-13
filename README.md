# Robots Think

**Daily AI newsletter for everyday people. No technical background required.**

Robots Think is an automated daily newsletter that explains what's happening in AI — and how to actually use it — for curious people who aren't developers. Five minutes, every weekday.

---

## What's in each issue

1. **Opening Statement** — personal, grounded, sets the tone
2. **Did You Hear?** — AI news translated into plain English
3. **Did You Know?** — one AI concept explained simply
4. **Did You Try?** — one AI tool or demo worth trying this week
5. **Did You Help?** — an organization using AI for good
6. **Healthy Tears** — one video that reminds you what's worth protecting

---

## How it works

Issues are generated daily by Claude (Anthropic's AI) via GitHub Actions and committed to this repo as static HTML files. No backend, no database — just a Node.js script, an API key, and a cron job.

**Generation pipeline:**
- `generate.js` — main daily generator (Node.js + Claude API)
- `.github/workflows/daily.yml` — scheduled GitHub Action (preview at 10pm PST, publish at 6am PST)
- `template.html` — email HTML template with `{{PLACEHOLDERS}}`
- `issues/` — individual issue archive files
- `issues.json` — master index of all published issues

**Preview → Publish flow:**
The daily workflow runs in two phases. The evening run generates tomorrow's issue to `preview/`. The morning run promotes that preview to `newsletter.html` and archives it, or generates fresh if no preview exists.

---

## Setup

### 1. Fork or clone this repo

```bash
git clone https://github.com/rasdo11/robotsthink.git
cd robotsthink
npm install
```

### 2. Add your Anthropic API key

In GitHub repo Settings → Secrets and variables → Actions, add:
```
ANTHROPIC_API_KEY=your_api_key_here
```

### 3. Enable GitHub Actions

Go to the Actions tab in your repo and enable workflows.

### 4. Set your launch date

In `generate.js`, update the `LAUNCH_DATE` in the `issueNumber()` function:
```javascript
const launch = new Date('2026-04-07T00:00:00'); // your launch date
```

### 5. Test locally

```bash
# Install dependencies
npm install

# Render a test issue using sample content
node render.js

# Generate a real issue (requires ANTHROPIC_API_KEY)
ANTHROPIC_API_KEY=your_key npm run generate
```

---

## Manual issue generation

Use the **Generate Robots Think Issue** GitHub Action (workflow_dispatch) to manually generate an issue with a custom brief. Paste your weekly brief into the workflow input and it will generate and commit the issue.

**Brief format:** See `.github/prompts/brief-template.md`

---

## Content pools

Edit these arrays in `generate.js` to customize the rotating content:

- `TECH_IMAGES` — Unsplash photo IDs used in the "Did You Try?" section
- `TEARS_STORIES` — YouTube video IDs and context for the "Healthy Tears" section

---

## File structure

```
robotsthink/
├── .github/
│   ├── prompts/
│   │   ├── system.md          # Claude system prompt (voice + audience)
│   │   └── brief-template.md  # Editor brief format
│   ├── scripts/
│   │   └── generate.py        # Python generator for manual issues
│   └── workflows/
│       ├── daily.yml          # Scheduled daily generation
│       └── generate-issue.yml # Manual issue generation
├── issues/                    # Individual issue HTML archive
├── generate.js                # Main generator
├── render.js                  # Offline renderer for testing
├── render_preview.mjs         # Preview renderer
├── template.html              # Email HTML template
├── index.html                 # Landing page
├── subscribe.html             # Subscription page
├── archive.html               # Archive page
├── content.json               # Sample content for testing
└── issues.json                # Master index of all issues
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |
| `PREVIEW` | No | Set to `1` for preview mode |
| `CONTENT_FILE` | No | Override content file for `render.js` |
| `DATE` | No | Override date for `render.js` (YYYY-MM-DD) |
