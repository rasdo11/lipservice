import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PREVIEW_PLACEHOLDER = '<!-- ARCHIVE_SECTION_PREVIEW_PLACEHOLDER -->';

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}
function issueNumber(date) {
  const launch = new Date('2026-03-05T00:00:00');
  return Math.max(1, Math.floor((date - launch) / 86400000) + 1);
}
function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' });
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
    </div>`).join('');
}

const contentFile = process.env.CONTENT_FILE || 'content_preview.json';
const content = JSON.parse(await fs.readFile(path.join(__dirname, contentFile), 'utf-8'));

const dateArg = process.env.DATE || '2026-03-07';
const today = new Date(dateArg + 'T12:00:00-08:00');
const day = dayOfYear(today);
const issueLabel = `Issue No. ${issueNumber(today)}`;
const issueDate = formatDate(today);
const key = dateKey(today);

const BEAUTY_IMAGES = [
  { photoId: '1596462502278-27bfdc403348', alt: 'Bold lip art editorial beauty 2026' },
  { photoId: '1512207736890-6ffed8a84e8d', alt: 'Luxury beauty editorial close up' },
  { photoId: '1522335789203-aabd1fc54bc9', alt: 'Fashion editorial runway beauty' },
  { photoId: '1487412720507-265dfe4c7f77', alt: 'Portrait fashion editorial' },
  { photoId: '1516975080664-ed2fc6a32937', alt: 'Beauty industry editorial' },
];
const TEARS_STORIES = [
  { videoId: 'bktozJWbLQg', videoLabel: "40 million people have watched this. You'll know why in 30 seconds." },
  { videoId: 'dPNHpJzRMcA', videoLabel: 'The speech that left the entire room still.' },
  { videoId: 'fJ9rUzIMcZQ', videoLabel: "The performance every musician studies. You'll understand after 30 seconds." },
];
const image = BEAUTY_IMAGES[day % BEAUTY_IMAGES.length];
const story = TEARS_STORIES[day % TEARS_STORIES.length];

const hearItemsHtml = buildHearItemsHtml(content.hear_items);
const openingBody = content.opening_body.includes('<p')
  ? content.opening_body
  : content.opening_body.split(/\n\n+/).map((p, i) =>
      i === 0 ? `<p class="drop-cap">${p.trim()}</p>` : `<p>${p.trim()}</p>`
    ).join('\n');
const tearsBody = content.tears_body.includes('<p')
  ? content.tears_body
  : content.tears_body.split(/\n\n+/).map(p => `<p>${p.trim()}</p>`).join('\n');

let html = await fs.readFile(path.join(__dirname, 'template.html'), 'utf-8');
html = html
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

const navBar = `<div class="issue-nav-bar" style="background:var(--rouge);color:#fff;padding:10px 20px;display:flex;justify-content:space-between;align-items:center;font-size:12px;font-family:sans-serif;">
  <span>&#128065; PREVIEW &#8212; goes live at 6am PST</span>
  <span>${issueLabel} &middot; ${issueDate}</span>
</div>`;

const previewHtml = html
  .replace('<div class="email-wrapper">', navBar + '\n<div class="email-wrapper">')
  .replace('{{ARCHIVE_SECTION}}', PREVIEW_PLACEHOLDER);

await fs.mkdir(path.join(__dirname, 'preview'), { recursive: true });
await fs.writeFile(path.join(__dirname, 'preview/index.html'), previewHtml, 'utf-8');
await fs.writeFile(path.join(__dirname, 'preview/meta.json'), JSON.stringify(
  { date: key, issueLabel, issueDate, heroText: content.hero_text }, null, 2
), 'utf-8');
console.log(`✓ preview/index.html (${issueLabel} — ${issueDate})`);
