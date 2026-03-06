import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Curated content pools ────────────────────────────────────────────────────
// Add more to each pool — the generator cycles through them by day of year.

const BEAUTY_IMAGES = [
  {
    photoId: '1596462502278-27bfdc403348',
    alt: 'Bold lip art editorial beauty 2026',
    caption: 'SS26 · Statement Lip Moment',
  },
  {
    photoId: '1512207736890-6ffed8a84e8d',
    alt: 'Luxury beauty editorial close up',
    caption: 'SS26 · Beauty Close-Up',
  },
  {
    photoId: '1522335789203-aabd1fc54bc9',
    alt: 'Fashion editorial runway beauty',
    caption: 'SS26 · Runway Beauty',
  },
  {
    photoId: '1487412720507-265dfe4c7f77',
    alt: 'Portrait fashion editorial',
    caption: 'SS26 · The Face',
  },
  {
    photoId: '1516975080664-ed2fc6a32937',
    alt: 'Beauty industry editorial',
    caption: 'SS26 · Industry Moment',
  },
];

// Each story has a YouTube video ID + context for Claude to write from.
// Verify video IDs are still live before adding them.
const TEARS_STORIES = [
  {
    videoId: 'bktozJWbLQg',
    context:
      'Alice Barker was a Harlem Renaissance chorus dancer — the Apollo, the Cotton Club, the Zanzibar — performing alongside Frank Sinatra, Gene Kelly, and Ella Fitzgerald. She made television history as one of the first Black dancers to perform on TV with a white man. She ended up in a Brooklyn nursing home with no photos, no footage, no proof that any of it happened. In 2015, a man spent three years tracking down her films and brought an iPad to her room and pressed play. She was 102. It was the first time she had ever seen herself dance.',
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Content generation ───────────────────────────────────────────────────────

async function generateContent(date, story) {
  const client = new Anthropic();

  const dateStr = formatDate(date);

  const prompt = `You are writing today's issue of LIP SERVICE — a sharp, witty, beautifully written daily newsletter about beauty, fashion, culture, and the things women actually care about.

Voice: Personal, specific, slightly wry. Think a brilliant friend who reads PubMed AND sends the unhinged meme. Never condescending, never preachy. The kind of writing that makes you feel like you were let in on something. Mix real beauty intel with cultural observation.

Today is ${dateStr}. Write all sections in this exact JSON format. Return ONLY valid, parseable JSON — no markdown fences, no explanation, no trailing commas.

{
  "hero_text": "2-3 sentence teaser in the voice of the newsletter. Name 3-4 specific things in today's issue — a brand drama, an ingredient, a beauty or fashion moment, and the charity. Witty and specific. Makes you want to read on.",

  "opening_headline": "A 2-line headline. Line 1 is plain text, line 2 uses <em> tags. Personal and slightly dark. E.g.: 'I went to the derm.<br><em>She was not impressed.</em>'",

  "opening_body": "3-4 paragraphs of personal essay. Wrap paragraphs in <p> tags. The FIRST paragraph must open with <p class=\\"drop-cap\\">. First-person voice, specific beauty or self-care incident, landing on a broader truth about beauty culture. End with a warm welcome to this issue. No placeholder names — write as the newsletter author.",

  "hear_headline": "2-line headline. E.g.: 'The group chat<br><em>is going off.</em>'",

  "hear_items": [
    {
      "tag": "one of: Brand Drama | Industry Moves | Runway Intel | Trend Alert | The Business",
      "headline": "A specific, slightly arch headline — like a WSJ beauty section",
      "body": "2-3 sentences. Specific, opinionated, dry. Include a detail that makes it feel reported."
    },
    {
      "tag": "...",
      "headline": "...",
      "body": "..."
    },
    {
      "tag": "...",
      "headline": "...",
      "body": "..."
    }
  ],

  "know_headline": "An ingredient or beauty science topic. 2 lines, second in <em> tags. E.g.: 'Salmon sperm is<br><em>in your serum now.</em>'",

  "know_intro": "A single paragraph (no <p> tags — parent already handles it) introducing the ingredient or trend. Where it came from, why it's having a moment right now.",

  "know_callout": "The scientific mechanism in 2-3 sentences. Use <strong> tags around the key scientific term. Factual but not dry.",

  "know_body": "2 paragraphs (no <p> tags). Who's using it, why it matters, the 360-degree context — the lifestyle factors (sleep, stress, gut health) that interact with it. End with something slightly uncomfortable-but-true.",

  "know_quote": "A real-feeling expert quote. Format: \\"Quote text.\\" — First Last, Title, Organization",

  "see_headline": "2-3 lines. Someone did something with makeup, fashion, or beauty. Specific. Second or third line in <em>. E.g.: 'Simone Rocha put<br><em>words on lips.</em><br>Literally.'",

  "see_body": "2 paragraphs (no <p> tags). A specific SS26 or AW26 runway or editorial beauty moment — real or plausibly real. End with a connection back to Lip Service.",

  "see_image_caption": "Season · Short description. E.g.: 'SS26 · Statement Lip Moment'",

  "help_headline": "Beauty as an act<br><em>of [something].</em>",

  "help_intro": "2-3 sentences introducing a real or real-feeling beauty charity or initiative. Include how and why it started.",

  "help_stat_number": "An impactful stat number. E.g.: '50K+' or '$1.2M' or '300'",

  "help_stat_label": "What that number represents. Short, specific, lowercase.",

  "help_body": "2-3 sentences (no <p> tags). One specific story or person who shows why this organization matters. End with what they need — volunteers, donors, awareness.",

  "help_cta_url": "https://[charity website]/donate or /get-involved — use a real charity's URL",

  "help_cta_text": "Donate to [Charity Name]",

  "tears_headline": "A poetic multi-line headline about the story below. Use <br> between lines, <em> for italic lines. Specific to the person and what happened.",

  "tears_body": "3-4 paragraphs (no <p> tags, separate with \\n\\n) about this story: ${story.context}\\n\\nWrite it fresh — do not copy the context verbatim. Start with the person and their world. Build to the moment. End with either a direct quote or a line that lands the emotional truth."
}`;

  console.log('Calling Claude API...');

  const stream = client.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  });

  const message = await stream.finalMessage();

  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('No text content in Claude response');

  // Strip any accidental markdown code fences
  const raw = textBlock.text.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '');

  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse Claude output as JSON:\n', raw.slice(0, 500));
    throw err;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const today = new Date();
  const day = dayOfYear(today);
  const issueNum = issueNumber(today);
  const issueLabel = `Issue No. ${issueNum}`;
  const issueDate = formatDate(today);

  const image = BEAUTY_IMAGES[day % BEAUTY_IMAGES.length];
  const story = TEARS_STORIES[day % TEARS_STORIES.length];

  console.log(`Generating ${issueLabel} — ${issueDate}`);

  const content = await generateContent(today, story);

  const template = await fs.readFile(path.join(__dirname, 'template.html'), 'utf-8');

  const hearItemsHtml = buildHearItemsHtml(content.hear_items);

  // Opening body: wrap bare paragraphs in <p> if Claude returned plain text blocks
  const openingBody = content.opening_body.includes('<p')
    ? content.opening_body
    : content.opening_body
        .split(/\n\n+/)
        .map((p, i) =>
          i === 0 ? `<p class="drop-cap">${p.trim()}</p>` : `<p>${p.trim()}</p>`
        )
        .join('\n');

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
    .replace('{{TEARS_BODY}}', content.tears_body.replace(/\n\n/g, '</p>\n<p>'))
    .replace('{{TEARS_VIDEO_URL}}', `https://www.youtube.com/watch?v=${story.videoId}`)
    .replace('{{TEARS_THUMB_URL}}', `https://img.youtube.com/vi/${story.videoId}/hqdefault.jpg`)
    .replace('{{TEARS_VIDEO_ALT}}', `Healthy Tears · ${issueDate}`)
    .replace('{{TEARS_VIDEO_LABEL}}', story.videoLabel);

  await fs.writeFile(path.join(__dirname, 'index.html'), html, 'utf-8');
  console.log(`✓ index.html written — ${issueLabel}`);
}

main().catch((err) => {
  console.error('Generation failed:', err.message);
  process.exit(1);
});
