import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Curated content pools ────────────────────────────────────────────────────
// Add more entries to each pool — the generator cycles through them by day of year.

const BEAUTY_IMAGES = [
  {
    photoId: '1596462502278-27bfdc403348',
    alt: 'Bold lip art editorial beauty 2026',
  },
  {
    photoId: '1512207736890-6ffed8a84e8d',
    alt: 'Luxury beauty editorial close up',
  },
  {
    photoId: '1522335789203-aabd1fc54bc9',
    alt: 'Fashion editorial runway beauty',
  },
  {
    photoId: '1487412720507-265dfe4c7f77',
    alt: 'Portrait fashion editorial',
  },
  {
    photoId: '1516975080664-ed2fc6a32937',
    alt: 'Beauty industry editorial',
  },
];

// Each story has a YouTube video ID + context for Claude to write from.
// Verify video IDs are still live before adding new entries.
const TEARS_STORIES = [
  {
    videoId: 'bktozJWbLQg',
    context:
      'Alice Barker was a Harlem Renaissance chorus dancer — the Apollo, the Cotton Club, the Zanzibar — performing alongside Frank Sinatra, Gene Kelly, and Ella Fitzgerald. She made television history as one of the first Black dancers to perform on TV with a white man. She ended up in a Brooklyn nursing home with no proof that any of it happened. In 2015, a man spent three years tracking down her films and brought an iPad to her room. She was 102. It was the first time she had ever seen herself dance.',
    videoLabel: "40 million people have watched this. You'll know why in 30 seconds.",
  },
  {
    videoId: 'dPNHpJzRMcA',
    context:
      'Viola Davis won the Emmy in 2015 — the first Black woman to win Outstanding Actress in a Drama — and gave a speech that quoted Harriet Tubman. The whole thing took less than two minutes. The room went completely silent.',
    videoLabel: 'The speech that left the entire room still.',
  },
  {
    videoId: 'fJ9rUzIMcZQ',
    context:
      "Freddie Mercury performing at Live Aid in 1985. 72,000 people in the stadium. He ran the crowd for 21 minutes with a level of command that music historians still describe as unrepeatable. He'd been told to cut the set short. He did not.",
    videoLabel: "The performance every musician studies. You'll understand after 30 seconds.",
  },
];

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

function buildHearItemsHtml(items) {
  return items
    .map(
      (item) => `
    <div class="gossip-item">
      <div class="gossip-tag">${item.tag}</div>
      <div class="gossip-headline">${item.headline}</div>
      <div class="gossip-body">${item.body}</div>
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

async function generateContent(date, story) {
  const client = new Anthropic();
  const dateStr = formatDate(date);

  const prompt = `You are writing today's issue of LIP SERVICE — a sharp, witty, beautifully written daily newsletter about beauty, fashion, culture, and the things women actually care about.

Voice: Personal, specific, slightly wry. Think a brilliant friend who reads PubMed AND sends the unhinged meme. Never condescending, never preachy. The kind of writing that makes you feel like you were let in on something.

IMPORTANT: Never use the words "preview", "draft", or "test" anywhere in the content. Write as if this is the final published issue.

Today is ${dateStr}. Write all sections in this exact JSON format. Return ONLY valid, parseable JSON — no markdown fences, no explanation, no trailing commas.

{
  "hero_text": "2-3 sentence teaser in the voice of the newsletter. Name 3-4 specific things in today's issue — a brand drama, an ingredient, a beauty or fashion moment, and the charity. Witty and specific. Makes you want to read on.",

  "opening_headline": "A 2-line headline. Line 1 is plain text, line 2 uses <em> tags. Personal and slightly dark. E.g.: 'I went to the derm.<br><em>She was not impressed.</em>'",

  "opening_body": "3-4 paragraphs of personal essay. Wrap paragraphs in <p> tags. The FIRST paragraph must open with <p class=\\"drop-cap\\">. First-person voice, specific beauty or self-care incident, landing on a broader truth about beauty culture. End with a warm welcome to this issue.",

  "hear_headline": "2-line headline. E.g.: 'The group chat<br><em>is going off.</em>'",

  "hear_items": [
    {
      "tag": "one of: Brand Drama | Industry Moves | Runway Intel | Trend Alert | The Business",
      "headline": "A specific, slightly arch headline — like a WSJ beauty section",
      "body": "2-3 sentences. Specific, opinionated, dry. Include a detail that makes it feel reported."
    },
    { "tag": "...", "headline": "...", "body": "..." },
    { "tag": "...", "headline": "...", "body": "..." }
  ],

  "know_headline": "An ingredient or beauty science topic. 2 lines, second in <em> tags. E.g.: 'Salmon sperm is<br><em>in your serum now.</em>'",

  "know_intro": "A single paragraph (no <p> tags) introducing the ingredient or trend.",

  "know_callout": "The scientific mechanism in 2-3 sentences. Use <strong> tags around the key scientific term.",

  "know_body": "2 paragraphs separated by a blank line (no <p> tags). Who's using it, the lifestyle context, something uncomfortable-but-true.",

  "know_quote": "A real-feeling expert quote. Format: \\"Quote text.\\" — First Last, Title, Organization",

  "see_headline": "2-3 lines. Someone did something with makeup or fashion. Second or third line in <em>. Specific.",

  "see_body": "2 paragraphs (no <p> tags). A specific SS26 or AW26 runway or editorial beauty moment. End with a connection to Lip Service.",

  "see_image_caption": "Season · Short description. E.g.: 'SS26 · Statement Lip Moment'",

  "help_headline": "Beauty as an act<br><em>of [something].</em>",

  "help_intro": "2-3 sentences introducing a real beauty charity or initiative. Include founding context.",

  "help_stat_number": "An impactful stat. E.g.: '50K+' or '$1.2M' or '300'",

  "help_stat_label": "What that number represents — short, specific, lowercase.",

  "help_body": "2-3 sentences (no <p> tags). One specific story that shows why this organization matters. End with what they need.",

  "help_cta_url": "https://[charity website]/donate or /get-involved",

  "help_cta_text": "Donate to [Charity Name]",

  "tears_headline": "A poetic multi-line headline about the story below. Use <br> between lines, <em> for italic lines. Specific to the person and what happened.",

  "tears_body": "3-4 paragraphs about this story: ${story.context}\\n\\nWrite it fresh — do not copy the context verbatim. Start with the person and their world. Build to the moment. End with either a direct quote from the person or a line that lands the emotional truth."
}`;

  console.log('Calling Claude API...');

  const stream = client.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 8000,
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

function renderHtml(template, content, image, story, issueLabel, issueDate) {
  const hearItemsHtml = buildHearItemsHtml(content.hear_items);

  const openingBody = content.opening_body.includes('<p')
    ? content.opening_body
    : content.opening_body
        .split(/\n\n+/)
        .map((p, i) =>
          i === 0 ? `<p class="drop-cap">${p.trim()}</p>` : `<p>${p.trim()}</p>`
        )
        .join('\n');

  const tearsBody = content.tears_body.includes('<p')
    ? content.tears_body
    : content.tears_body
        .split(/\n\n+/)
        .map((p) => `<p>${p.trim()}</p>`)
        .join('\n');

  return template
    .replace(/\{\{ISSUE_LABEL\}\}/g, issueLabel)
    .replace(/\{\{ISSUE_DATE\}\}/g, issueDate)
    .replace('{{HERO_TEXT}}', content.hero_text)
    .replace('{{OPENING_HEADLINE}}', content.opening_headline)
    .replace('{{OPENING_BODY}}', openingBody)
    .replace('{{HEAR_HEADLINE}}', content.hear_headline)
    .replace('{{HEAR_ITEMS}}', hearItemsHtml)
    .replace('{{KNOW_HEADLINE}}', content.know_headline)
    .replace('{{KNOW_INTRO}}', content.know_intro)
    .replace('{{KNOW_CALLOUT}}', content.know_callout)
    .replace('{{KNOW_BODY}}', content.know_body)
    .replace('{{KNOW_QUOTE}}', content.know_quote)
    .replace('{{SEE_HEADLINE}}', content.see_headline)
    .replace('{{SEE_IMAGE_URL}}', `https://images.unsplash.com/photo-${image.photoId}?w=600&q=80`)
    .replace('{{SEE_IMAGE_ALT}}', image.alt)
    .replace('{{SEE_IMAGE_CAPTION}}', content.see_image_caption)
    .replace('{{SEE_BODY}}', content.see_body)
    .replace('{{HELP_HEADLINE}}', content.help_headline)
    .replace('{{HELP_INTRO}}', content.help_intro)
    .replace('{{HELP_STAT_NUMBER}}', content.help_stat_number)
    .replace('{{HELP_STAT_LABEL}}', content.help_stat_label)
    .replace('{{HELP_BODY}}', content.help_body)
    .replace('{{HELP_CTA_URL}}', content.help_cta_url)
    .replace('{{HELP_CTA_TEXT}}', content.help_cta_text)
    .replace('{{TEARS_HEADLINE}}', content.tears_headline)
    .replace('{{TEARS_BODY}}', tearsBody)
    .replace('{{TEARS_VIDEO_URL}}', `https://www.youtube.com/watch?v=${story.videoId}`)
    .replace('{{TEARS_THUMB_URL}}', `https://img.youtube.com/vi/${story.videoId}/hqdefault.jpg`)
    .replace('{{TEARS_VIDEO_ALT}}', `Healthy Tears · ${issueDate}`)
    .replace('{{TEARS_VIDEO_LABEL}}', story.videoLabel);
}

// ─── Promote preview → live ───────────────────────────────────────────────────

const PREVIEW_PLACEHOLDER = '<!-- ARCHIVE_SECTION_PREVIEW_PLACEHOLDER -->';

async function promotePreview() {
  const previewDir = path.join(__dirname, 'preview');
  const previewHtml = await fs.readFile(path.join(previewDir, 'index.html'), 'utf-8');
  const meta = JSON.parse(await fs.readFile(path.join(previewDir, 'meta.json'), 'utf-8'));
  const { date: key, issueLabel, issueDate, heroText } = meta;

  console.log(`Promoting preview → live: ${issueLabel} — ${issueDate}`);

  // Update archive
  const issuesDir = path.join(__dirname, 'issues');
  await fs.mkdir(issuesDir, { recursive: true });
  const archivePath = path.join(issuesDir, 'archive.json');
  let archive = [];
  try { archive = JSON.parse(await fs.readFile(archivePath, 'utf-8')); } catch {}
  archive = archive.filter((e) => e.date !== key);
  archive.unshift({ date: key, issueLabel, issueDate, heroText });
  await fs.writeFile(archivePath, JSON.stringify(archive, null, 2), 'utf-8');

  // Strip preview nav bar, replace archive placeholder with nothing (inbox-only)
  const cleanHtml = previewHtml.replace(/<div class="issue-nav-bar"[^>]*>[\s\S]*?<\/div>\n?/, '');
  const newsletterHtml = cleanHtml
    .replace(PREVIEW_PLACEHOLDER, '')
    .replace(/\{\{ROOT\}\}/g, '');
  await fs.writeFile(path.join(__dirname, 'newsletter.html'), newsletterHtml, 'utf-8');
  console.log(`  ✓ newsletter.html (${issueLabel})`);

  // Write archive page
  await fs.writeFile(path.join(__dirname, 'archive.html'), buildArchivePage(archive), 'utf-8');
  console.log(`  ✓ archive.html (${archive.length} issue${archive.length !== 1 ? 's' : ''})`);

  // Clean up preview/
  await fs.rm(previewDir, { recursive: true });
  console.log('  ✓ preview/ cleaned up');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // ── Publish mode: promote preview if available ─────────────────────────────
  if (!PREVIEW_MODE) {
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

  const day = dayOfYear(today);
  const issueNum = issueNumber(today);
  const issueLabel = `Issue No. ${issueNum}`;
  const issueDate = formatDate(today);
  const key = dateKey(today);

  const image = BEAUTY_IMAGES[day % BEAUTY_IMAGES.length];
  const story = TEARS_STORIES[day % TEARS_STORIES.length];

  console.log(`${PREVIEW_MODE ? 'Previewing' : 'Generating'} ${issueLabel} — ${issueDate}`);

  const content = await generateContent(today, story);
  const template = await fs.readFile(path.join(__dirname, 'template.html'), 'utf-8');
  const html = renderHtml(template, content, image, story, issueLabel, issueDate);

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
      { date: key, issueLabel, issueDate, heroText: content.hero_text }, null, 2
    ), 'utf-8');
    console.log(`  ✓ preview/index.html (${issueLabel}) — live at /preview/`);
  } else {
    // ── Normal publish: write newsletter.html + archive.html ───────────────
    const issuesDir = path.join(__dirname, 'issues');
    await fs.mkdir(issuesDir, { recursive: true });

    const archivePath = path.join(issuesDir, 'archive.json');
    let archive = [];
    try { archive = JSON.parse(await fs.readFile(archivePath, 'utf-8')); } catch {}
    archive = archive.filter((e) => e.date !== key);
    archive.unshift({ date: key, issueLabel, issueDate, heroText: content.hero_text });
    await fs.writeFile(archivePath, JSON.stringify(archive, null, 2), 'utf-8');

    const newsletterHtml = html
      .replace('{{ARCHIVE_SECTION}}', '')
      .replace(/\{\{ROOT\}\}/g, '');
    await fs.writeFile(path.join(__dirname, 'newsletter.html'), newsletterHtml, 'utf-8');
    console.log(`  ✓ newsletter.html (${issueLabel})`);

    await fs.writeFile(path.join(__dirname, 'archive.html'), buildArchivePage(archive), 'utf-8');
    console.log(`  ✓ archive.html (${archive.length} issue${archive.length !== 1 ? 's' : ''})`);
  }
}

main().catch((err) => {
  console.error('Generation failed:', err.message);
  process.exit(1);
});
