/**
 * Offline renderer — reads content from CONTENT_FILE env var (or content.json),
 * then renders index.html and issues/ using the same logic as generate.js.
 * Usage: CONTENT_FILE=issue2.json node render.js
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Helpers (duplicated from generate.js) ────────────────────────────────────

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}

function issueNumber(date) {
  const launch = new Date('2026-04-07T00:00:00');
  const diff = Math.floor((date - launch) / 86400000) + 1;
  return Math.max(1, diff);
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    timeZone: 'America/Los_Angeles',
  });
}

function dateKey(date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

function buildHearItemsHtml(items) {
  return items.map(item => `
    <div class="gossip-item">
      <div class="gossip-tag">${item.tag}</div>
      <div class="gossip-headline">${item.headline}</div>
      <div class="gossip-body">${item.body}</div>
    </div>`).join('\n');
}

function buildArchiveSectionHtml(archive) {
  const past = archive.slice(1);
  if (past.length === 0) return '';
  const items = past.map(entry => `
      <a href="issues/${entry.date}.html" class="archive-item">
        <div class="archive-item-meta">
          <span class="archive-item-label">${entry.issueLabel}</span>
          <span class="archive-item-date">${entry.issueDate}</span>
        </div>
        <div class="archive-item-teaser">${entry.heroText}</div>
      </a>`).join('\n');
  return `
  <div class="section archive-section">
    <div class="section-label">
      <div class="section-number" style="font-size:13px; line-height:1;">↩</div>
      <div class="section-title">Past Issues</div>
    </div>
    <div class="archive-list">
      ${items}
    </div>
  </div>`;
}

function buildIssuePage(html, issueLabel, issueDate) {
  const navBar = `<div class="issue-nav-bar">
  <a href="../index.html">← Today's issue</a>
  <span>${issueLabel} &middot; ${issueDate}</span>
</div>`;
  const backLink = `
  <div class="section" style="text-align:center; padding:20px 24px; border-bottom:none;">
    <a href="../index.html" style="font-size:11px;color:var(--rouge);text-decoration:none;letter-spacing:2px;text-transform:uppercase;font-weight:500;">← Today's issue</a>
  </div>`;
  return html
    .replace('<div class="email-wrapper">', `${navBar}\n<div class="email-wrapper">`)
    .replace('{{ARCHIVE_SECTION}}', backLink);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const contentFile = process.env.CONTENT_FILE || 'content.json';
  const content = JSON.parse(await fs.readFile(path.join(__dirname, contentFile), 'utf-8'));

  // Use DATE env var if set, otherwise today
  const today = process.env.DATE ? new Date(process.env.DATE + 'T12:00:00') : new Date();
  const day = dayOfYear(today);
  const issueNum = issueNumber(today);
  const issueLabel = `Issue No. ${issueNum}`;
  const issueDate = formatDate(today);
  const key = dateKey(today);

  const TECH_IMAGES = [
    { photoId: '1677442135703-1787eea5ce01', alt: 'Abstract AI neural network visualization' },
    { photoId: '1620712943543-bcc4688e7485', alt: 'Human hand touching a glowing digital interface' },
    { photoId: '1518770660439-4636190af475', alt: 'Circuit board close-up technology detail' },
    { photoId: '1485827404703-89b55fcc595e', alt: 'Robot and human working together' },
    { photoId: '1526374965328-7f61d4dc18c5', alt: 'Digital data flowing through abstract space' },
  ];
  const TEARS_STORIES = [
    { videoId: 'bktozJWbLQg', videoLabel: "40 million people have watched this. You'll know why in 30 seconds." },
    { videoId: 'UF8uR6Z6KLc', videoLabel: 'Fifteen minutes. No notes. Still the best advice about how to live.' },
    { videoId: 'fJ9rUzIMcZQ', videoLabel: "The performance every musician studies. You'll understand after 30 seconds." },
  ];

  const image = TECH_IMAGES[day % TECH_IMAGES.length];
  const story = TEARS_STORIES[day % TEARS_STORIES.length];

  console.log(`Rendering ${issueLabel} — ${issueDate}`);

  // Archive
  const issuesDir = path.join(__dirname, 'issues');
  await fs.mkdir(issuesDir, { recursive: true });
  const archivePath = path.join(issuesDir, 'archive.json');
  let archive = [];
  try { archive = JSON.parse(await fs.readFile(archivePath, 'utf-8')); } catch {}
  archive = archive.filter(e => e.date !== key);
  archive.unshift({ date: key, issueLabel, issueDate, heroText: content.hero_text });
  await fs.writeFile(archivePath, JSON.stringify(archive, null, 2), 'utf-8');

  const template = await fs.readFile(path.join(__dirname, 'template.html'), 'utf-8');
  const hearItemsHtml = buildHearItemsHtml(content.hear_items);

  const openingBody = content.opening_body.includes('<p')
    ? content.opening_body
    : content.opening_body.split(/\n\n+/).map((p, i) =>
        i === 0 ? `<p class="drop-cap">${p.trim()}</p>` : `<p>${p.trim()}</p>`
      ).join('\n');

  const tearsBody = content.tears_body.includes('<p')
    ? content.tears_body
    : content.tears_body.split(/\n\n+/).map(p => `<p>${p.trim()}</p>`).join('\n');

  const html = template
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

  // Standalone issue page
  const issuePageHtml = buildIssuePage(html, issueLabel, issueDate);
  await fs.writeFile(path.join(issuesDir, `${key}.html`), issuePageHtml, 'utf-8');
  console.log(`  ✓ issues/${key}.html`);

  // index.html with archive
  const indexHtml = html.replace('{{ARCHIVE_SECTION}}', buildArchiveSectionHtml(archive));
  await fs.writeFile(path.join(__dirname, 'index.html'), indexHtml, 'utf-8');
  console.log(`  ✓ index.html (${issueLabel})`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
