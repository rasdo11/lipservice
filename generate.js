import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));


// ─── Date helpers ─────────────────────────────────────────────────────────────

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}

function issueNumber(date) {
  // Issue 1 launched March 5, 2026
  const launch = new Date('2026-03-05T00:00:00');
  const diff = Math.floor((date - launch) / 86400000) + 1;
  return Math.max(1, diff);
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Los_Angeles',
  });
}

// YYYY-MM-DD in Pacific time — used as the archive key and filename
function dateKey(date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

// ─── HTML builders ────────────────────────────────────────────────────────────

function buildQuickHitsHtml(items) {
  return items
    .map(
      (item) => `
    <div class="gossip-item">
      <div class="gossip-headline">${item.headline}</div>
      <div class="gossip-body">${item.body}</div>
    </div>`
    )
    .join('\n');
}

function buildLips6Html(items) {
  return items
    .map(
      (item, i) => `
    <div class="lips6-item">
      <div class="lips6-number">${i + 1}</div>
      <div class="lips6-text">${item}</div>
    </div>`
    )
    .join('\n');
}

function buildCalendarHtml(items) {
  return items
    .map(
      (item) => `
    <div class="cal-item">
      <div class="cal-date">${item.date}</div>
      <div class="cal-event">${item.event}</div>
    </div>`
    )
    .join('\n');
}

// Standalone archive page: clean list of all issues, newest to oldest
function buildArchivePage(archive) {
  const items = archive.length === 0
    ? '<li class="archive-empty">No issues published yet.</li>'
    : archive.map((entry) => `
      <li class="archive-item">
        <span class="archive-meta">
          <span class="archive-label">${entry.issueLabel}</span>
          <span class="archive-dot">·</span>
          <span class="archive-date">${entry.issueDate}</span>
        </span>
        <span class="archive-teaser">${entry.heroText}</span>
      </li>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Archive — Lip Service</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500&display=swap" rel="stylesheet">
<style>
  :root { --ink:#16120E; --cream:#FAF7F2; --rouge:#C13333; --warm:#9A8880; --divider:#E4DBD4; }
  *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
  body { background:var(--cream); color:var(--ink); font-family:'DM Sans',sans-serif; font-size:16px; line-height:1.6; -webkit-font-smoothing:antialiased; min-height:100vh; display:flex; flex-direction:column; }
  body::before { content:''; position:fixed; inset:0; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E"); pointer-events:none; z-index:100; opacity:0.4; }
  .top-bar { display:flex; justify-content:space-between; align-items:center; padding:20px 40px; border-bottom:1px solid var(--divider); }
  .top-bar-logo { font-family:'Playfair Display',serif; font-size:22px; font-weight:900; letter-spacing:-0.5px; color:var(--ink); text-decoration:none; }
  .top-bar-back { font-size:11px; letter-spacing:2.5px; text-transform:uppercase; color:var(--warm); text-decoration:none; font-weight:400; transition:color 0.2s; }
  .top-bar-back:hover { color:var(--ink); }
  main { flex:1; max-width:720px; width:100%; margin:0 auto; padding:64px 40px 80px; }
  .page-eyebrow { font-size:10px; letter-spacing:4px; text-transform:uppercase; color:var(--rouge); font-weight:500; margin-bottom:16px; display:flex; align-items:center; gap:12px; }
  .page-eyebrow::before { content:''; display:inline-block; width:24px; height:1px; background:var(--rouge); }
  .page-headline { font-family:'Playfair Display',serif; font-size:clamp(36px,5vw,56px); font-weight:900; line-height:1.05; letter-spacing:-2px; color:var(--ink); margin-bottom:48px; }
  .page-headline em { font-style:italic; color:var(--rouge); }
  .archive-list { list-style:none; border-top:1px solid var(--divider); }
  .archive-item { padding:24px 0; border-bottom:1px solid var(--divider); display:flex; flex-direction:column; gap:8px; }
  .archive-empty { padding:24px 0; color:var(--warm); font-size:14px; font-weight:300; }
  .archive-meta { display:flex; align-items:center; gap:10px; }
  .archive-label { font-family:'Playfair Display',serif; font-size:14px; font-weight:700; color:var(--ink); letter-spacing:-0.2px; }
  .archive-dot { color:var(--rouge); font-size:12px; }
  .archive-date { font-size:12px; letter-spacing:1.5px; text-transform:uppercase; color:var(--warm); font-weight:400; }
  .archive-teaser { font-size:14px; color:var(--warm); line-height:1.6; font-weight:300; max-width:600px; }
  footer { border-top:1px solid var(--divider); padding:24px 40px; display:flex; justify-content:space-between; align-items:center; }
  .footer-logo { font-family:'Playfair Display',serif; font-size:16px; font-weight:900; color:var(--ink); }
  .footer-copy { font-size:11px; color:#C0B5AE; font-weight:300; }
  @media (max-width:600px) { .top-bar { padding:18px 20px; } main { padding:48px 20px 60px; } footer { flex-direction:column; gap:8px; text-align:center; padding:20px; } }
</style>
</head>
<body>
<header class="top-bar">
  <a href="index.html" class="top-bar-logo">Lip Service</a>
  <a href="index.html" class="top-bar-back">← Home</a>
</header>
<main>
  <div class="page-eyebrow">Every issue</div>
  <h1 class="page-headline">The <em>archive.</em></h1>
  <ul class="archive-list">
    ${items}
  </ul>
</main>
<footer>
  <div class="footer-logo">Lip Service</div>
  <div class="footer-copy">Weekly beauty. No apologies. © 2026</div>
</footer>
</body>
</html>`;
}

// ─── Content generation ───────────────────────────────────────────────────────

async function generateContent(date) {
  const client = new Anthropic();
  const dateStr = formatDate(date);

  const prompt = `You are writing today's issue of LIP SERVICE — a sharp, witty, beautifully written daily newsletter for financially comfortable, scientifically literate women in their mid-30s to late-40s.

Voice: Her brilliant, slightly chaotic best friend who just got back from a derm appointment and has receipts. Gossip Girl with a biochem minor and a complicated relationship with filler. Dark humor. Self-aware. Fierce. Fun. Never preachy. The conversation is already in progress — she knows what she's talking about.

IMPORTANT: Never use the words "preview", "draft", or "test" anywhere in the content. Write as if this is the final published issue.

Today is ${dateStr}. Write all seven sections in this exact JSON format. Return ONLY valid, parseable JSON — no markdown fences, no explanation, no trailing commas.

{
  "preview": "2-3 sentence teaser. Written like a subject line you'd actually open. Name the specific things in today's issue. Max 280 chars.",

  "injection_report": "150-200 words. First-person confessional opener. Voice-note energy. A specific beauty or derm incident that opens into a broader truth. Plain text, no HTML tags.",

  "put_it_in_your_mouth": "100-140 words. One ingestible — food, drink, supplement — and what it actually does for skin, hair, or the nervous system. Not a lecture. End with a concrete takeaway. Plain text.",

  "lip_lab": "150-180 words. One ingredient, one study, one mechanism — explained like a smart friend at dinner, not a white paper. End with one sentence connecting it back to real life. Plain text.",

  "lips_in_6": [
    "Item 1 — 20-30 words. Product, observation, industry note, or thing she tried.",
    "Item 2.",
    "Item 3.",
    "Item 4.",
    "Item 5.",
    "Item 6."
  ],

  "quick_hits": [
    {
      "headline": "Specific, slightly arch headline — like a WSJ beauty section",
      "body": "2-3 sentences. Specific, opinionated, dry. Include a detail that makes it feel reported."
    },
    { "headline": "...", "body": "..." },
    { "headline": "...", "body": "..." }
  ],

  "on_our_calendar": [
    { "date": "Month DD", "event": "1-2 sentences. A launch, event, or date worth marking. Specific, not vague." },
    { "date": "Month DD", "event": "..." },
    { "date": "Month DD", "event": "..." }
  ],

  "last_word": "60-80 words. The thing that earns its place at the end. A cause, a person, a moment — something that lands without sentimentality. Plain text."
}`;

  console.log('Calling Claude API...');

  const stream = client.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const message = await stream.finalMessage();

  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock) {
    console.error('stop_reason:', message.stop_reason);
    console.error('content blocks:', JSON.stringify(message.content.map((b) => b.type)));
    throw new Error('No text content in Claude response');
  }

  // Strip any accidental markdown code fences
  const raw = textBlock.text.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '');

  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse Claude output as JSON:\n', raw.slice(0, 500));
    throw err;
  }
}

// ─── Mode ─────────────────────────────────────────────────────────────────────
// PREVIEW=1  → generate tomorrow's issue to preview/index.html (no live site change)
// (default)  → promote preview/index.html if it exists, otherwise generate fresh

const PREVIEW_MODE = process.env.PREVIEW === '1';

// ─── Shared render helper ─────────────────────────────────────────────────────

function buildOgMeta(issueLabel, preview, issueUrl) {
  const desc = preview.replace(/"/g, '&quot;').replace(/\n/g, ' ').slice(0, 300);
  const title = `Lip Service — ${issueLabel}`;
  return [
    `<meta property="og:type" content="article">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${desc}">`,
    issueUrl ? `<meta property="og:url" content="${issueUrl}">` : '',
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${desc}">`,
  ].filter(Boolean).join('\n');
}

function renderHtml(template, content, issueLabel, issueDate, issueUrl) {
  const ogMeta = buildOgMeta(issueLabel, content.preview, issueUrl);
  return template
    .replace(/\{\{ISSUE_LABEL\}\}/g, issueLabel)
    .replace(/\{\{ISSUE_DATE\}\}/g, issueDate)
    .replace('{{OG_META}}', ogMeta)
    .replace('{{ISSUE_URL}}', issueUrl || '#')
    .replace('{{PREVIEW}}', content.preview)
    .replace('{{INJECTION_REPORT}}', content.injection_report)
    .replace('{{PUT_IT_IN_YOUR_MOUTH}}', content.put_it_in_your_mouth)
    .replace('{{LIP_LAB}}', content.lip_lab)
    .replace('{{LIPS_IN_6}}', buildLips6Html(content.lips_in_6))
    .replace('{{QUICK_HITS}}', buildQuickHitsHtml(content.quick_hits))
    .replace('{{ON_OUR_CALENDAR}}', buildCalendarHtml(content.on_our_calendar))
    .replace('{{LAST_WORD}}', content.last_word);
}

// ─── Promote preview → live ───────────────────────────────────────────────────

const PREVIEW_PLACEHOLDER = '<!-- ARCHIVE_SECTION_PREVIEW_PLACEHOLDER -->';

async function promotePreview() {
  const previewDir = path.join(__dirname, 'preview');
  const previewHtml = await fs.readFile(path.join(previewDir, 'index.html'), 'utf-8');
  const meta = JSON.parse(await fs.readFile(path.join(previewDir, 'meta.json'), 'utf-8'));
  const { date: key, issueLabel, issueDate, heroText } = meta;

  console.log(`Promoting preview → live: ${issueLabel} — ${issueDate}`);

  // Update issues.json
  const issuesDir = path.join(__dirname, 'issues');
  await fs.mkdir(issuesDir, { recursive: true });
  const issuesJsonPath = path.join(__dirname, 'issues.json');
  let archive = [];
  try { archive = JSON.parse(await fs.readFile(issuesJsonPath, 'utf-8')); } catch {}
  const issueNum = parseInt((issueLabel.match(/\d+/) || ['0'])[0], 10);
  archive = archive.filter((e) => e.date !== key);
  archive.unshift({ issue: issueNum, date: key, title: issueLabel, preview: heroText, slug: key, url: `./issues/${key}.html` });
  await fs.writeFile(issuesJsonPath, JSON.stringify(archive, null, 2), 'utf-8');

  // Strip preview nav bar, replace archive placeholder with nothing (inbox-only)
  const cleanHtml = previewHtml.replace(/<div class="issue-nav-bar"[^>]*>[\s\S]*?<\/div>\n?/, '');
  const newsletterHtml = cleanHtml
    .replace(PREVIEW_PLACEHOLDER, '')
    .replace(/\{\{ROOT\}\}/g, '');
  await fs.writeFile(path.join(__dirname, 'newsletter.html'), newsletterHtml, 'utf-8');
  console.log(`  ✓ newsletter.html (${issueLabel})`);

  // Write individual issue file (required for idempotency check on retry crons)
  await fs.writeFile(path.join(issuesDir, `${key}.html`), newsletterHtml, 'utf-8');
  console.log(`  ✓ issues/${key}.html`);

  console.log(`  ✓ issues.json (${archive.length} issue${archive.length !== 1 ? 's' : ''})`);

  // Clean up preview/
  await fs.rm(previewDir, { recursive: true });
  console.log('  ✓ preview/ cleaned up');

  // Update homepage "Latest issue →" link
  const indexPath = path.join(__dirname, 'index.html');
  const indexHtml = await fs.readFile(indexPath, 'utf-8');
  const updatedIndex = indexHtml.replace(
    /(<a href=")[^"]*("[^>]*class="nav-cta")/,
    `$1issues/${key}.html$2`
  );
  await fs.writeFile(indexPath, updatedIndex, 'utf-8');
  console.log(`  ✓ index.html nav link → issues/${key}.html`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // ── Publish mode: promote preview if available ─────────────────────────────
  if (!PREVIEW_MODE) {
    // Idempotency: skip if today's issue already exists (handles retry crons)
    const todayKey = dateKey(new Date());
    const issueFile = path.join(__dirname, 'issues', `${todayKey}.html`);
    try {
      await fs.access(issueFile);
      console.log(`Today's issue already published (${todayKey}), skipping.`);
      return;
    } catch {}

    let previewExists = false;
    try { await fs.access(path.join(__dirname, 'preview', 'index.html')); previewExists = true; } catch {}
    if (previewExists) {
      await promotePreview();
      return;
    }
    console.log('No preview found — generating fresh...');
  }

  // ── Determine target date ──────────────────────────────────────────────────
  // Preview mode generates tomorrow's issue (running at 10pm PST means UTC is already tomorrow)
  // We add 24h so that dateKey() in Pacific time gives us the next Pacific calendar day.
  const today = PREVIEW_MODE
    ? new Date(Date.now() + 24 * 60 * 60 * 1000)
    : new Date();

  const issueNum = issueNumber(today);
  const issueLabel = `Issue No. ${issueNum}`;
  const issueDate = formatDate(today);
  const key = dateKey(today);
  const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '');
  const issueUrl = siteUrl ? `${siteUrl}/issues/${key}.html` : `./issues/${key}.html`;

  console.log(`${PREVIEW_MODE ? 'Previewing' : 'Generating'} ${issueLabel} — ${issueDate}`);

  const content = await generateContent(today);
  const template = await fs.readFile(path.join(__dirname, 'template.html'), 'utf-8');
  const html = renderHtml(template, content, issueLabel, issueDate, issueUrl);

  if (PREVIEW_MODE) {
    // ── Write preview/ (no changes to live site) ───────────────────────────
    const previewDir = path.join(__dirname, 'preview');
    await fs.mkdir(previewDir, { recursive: true });

    // Replace archive section with a visible placeholder for the preview viewer
    const previewNavBar = `<div class="issue-nav-bar" style="background:var(--rouge);color:#fff;">
  <span>👁 PREVIEW — goes live at 6am PST</span>
  <span>${issueLabel} &middot; ${issueDate}</span>
</div>`;
    const previewHtml = html
      .replace('<div class="email-wrapper">', `${previewNavBar}\n<div class="email-wrapper">`)
      .replace('{{ARCHIVE_SECTION}}', PREVIEW_PLACEHOLDER)
      .replace(/\{\{ROOT\}\}/g, '../');

    await fs.writeFile(path.join(previewDir, 'index.html'), previewHtml, 'utf-8');
    await fs.writeFile(path.join(previewDir, 'meta.json'), JSON.stringify(
      { date: key, issueLabel, issueDate, heroText: content.preview }, null, 2
    ), 'utf-8');
    console.log(`  ✓ preview/index.html (${issueLabel}) — live at /preview/`);
  } else {
    // ── Normal publish: write newsletter.html + issues.json ───────────────
    const issuesDir = path.join(__dirname, 'issues');
    await fs.mkdir(issuesDir, { recursive: true });

    const issuesJsonPath = path.join(__dirname, 'issues.json');
    let archive = [];
    try { archive = JSON.parse(await fs.readFile(issuesJsonPath, 'utf-8')); } catch {}
    archive = archive.filter((e) => e.date !== key);
    archive.unshift({ issue: issueNum, date: key, title: issueLabel, preview: content.preview, slug: key, url: `./issues/${key}.html` });
    await fs.writeFile(issuesJsonPath, JSON.stringify(archive, null, 2), 'utf-8');

    const newsletterHtml = html
      .replace('{{ARCHIVE_SECTION}}', '')
      .replace(/\{\{ROOT\}\}/g, '');
    await fs.writeFile(path.join(__dirname, 'newsletter.html'), newsletterHtml, 'utf-8');
    console.log(`  ✓ newsletter.html (${issueLabel})`);

    // Write individual issue file (required for idempotency check on retry crons)
    await fs.writeFile(path.join(issuesDir, `${key}.html`), newsletterHtml, 'utf-8');
    console.log(`  ✓ issues/${key}.html`);

    console.log(`  ✓ issues.json (${archive.length} issue${archive.length !== 1 ? 's' : ''})`);

    // Update homepage "Latest issue →" link
    const indexPath = path.join(__dirname, 'index.html');
    const indexHtml = await fs.readFile(indexPath, 'utf-8');
    const updatedIndex = indexHtml.replace(
      /(<a href=")[^"]*("[^>]*class="nav-cta")/,
      `$1issues/${key}.html$2`
    );
    await fs.writeFile(indexPath, updatedIndex, 'utf-8');
    console.log(`  ✓ index.html nav link → issues/${key}.html`);
  }
}

main().catch((err) => {
  console.error('Generation failed:', err.message);
  process.exit(1);
});
