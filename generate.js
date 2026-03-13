import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';
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
// Selection avoids videos used in recent issues — expand the pool to reduce repeats.
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
  {
    videoId: 'RxPZh4AnWyk',
    context:
      "Susan Boyle walked onto the Britain's Got Talent stage in 2009. She was 47, from a small Scottish village, wore a frumpy beige dress, and announced she wanted to be a professional singer. The audience laughed. Simon Cowell raised an eyebrow. Then she opened her mouth and sang \"I Dreamed a Dream,\" and within thirty seconds you could see the exact moment every person in that room realized they had made a catastrophic error in judgment. The clip was watched 47 million times in the first week. She became the best-selling debut artist in UK chart history that year.",
    videoLabel: "The 30 seconds that humbled an entire room.",
  },
  {
    videoId: 'Xe1Qyskxd5E',
    context:
      "Aretha Franklin performed \"(You Make Me Feel Like) A Natural Woman\" at the Kennedy Center Honors in 2015, honoring Carole King. She took off her fur coat mid-song, threw it to the floor, and kept going. President Obama wiped tears from his eyes. Carole King put her hand over her mouth and wept. The performance is often described as the greatest live vocal performance ever captured on video.",
    videoLabel: "The performance that made a president cry.",
  },
  {
    videoId: 'inXC_lab-34',
    context:
      "Malala Yousafzai addressed the United Nations in 2013, one year after being shot in the head by the Taliban for advocating girls' education. She was 16. She stood at the podium in a pink headscarf and spoke for 18 minutes without notes. \"One child, one teacher, one book, one pen can change the world.\" She did not seem afraid of anything.",
    videoLabel: "Sixteen years old. Shot in the head. Still not afraid.",
  },
  {
    videoId: '3nEnBJJMKQs',
    context:
      "Simone Biles at the 2016 Rio Olympics, performing the floor exercise that no other gymnast on earth could execute. She invented moves that the governing body named after her — because no one else could do them. Commentators ran out of words. Sports journalists called it the greatest athletic performance they had ever witnessed in person.",
    videoLabel: "The routine that redefined what a human body can do.",
  },
  {
    videoId: 'IurigVoZRHY',
    context:
      "Toni Morrison accepted the Nobel Prize in Literature in 1993 and delivered a lecture that began with a parable about an old blind woman and a bird. For thirty minutes she spoke about the power of language — how it can oppress, how it can liberate, how the word is always in our hands. At the end the room was silent for a long moment before the applause started.",
    videoLabel: "The greatest writer alive, on what language is actually for.",
  },
  {
    videoId: 'vuEQixrBKCc',
    context:
      "Nina Simone performing \"Feeling Good\" live. She recorded the definitive version in 1965. But live, with a full band, she played it like she invented the concept of freedom. There is a moment mid-song where she stops and looks at the audience and the silence says more than the words. Music critics still argue about which live performance is the definitive one. They are all correct.",
    videoLabel: "The song that sounds different every time, because she meant it differently every time.",
  },
  {
    videoId: 'OHRuRSCFo04',
    context:
      "Celine Dion performed \"My Heart Will Go On\" at the 2017 Billboard Music Awards, her first major performance since the death of her husband René Angélil — the man who discovered her when she was 12 and managed her career for 35 years. She hadn't performed in two years. She walked onstage in a black and white gown and sang the song that had defined both their lives, and she did not look away from the camera once.",
    videoLabel: "She hadn't performed in two years. She didn't look away once.",
  },
  {
    videoId: 'ygqCQbpHpxs',
    context:
      "Misty Copeland became the first Black principal dancer at American Ballet Theatre in 2015, after being told at 13 that her body was wrong for ballet — too muscular, too short, turned down by the most prestigious training programs in the country. She kept training anyway. When ABT announced her promotion, she was in the middle of a sold-out run of Swan Lake. The curtain call lasted eleven minutes.",
    videoLabel: "They told her she had the wrong body. She became the standard.",
  },
  {
    videoId: 'Q0Wd8BQMRVE',
    context:
      "Ruth Bader Ginsburg, at age 60, asked to join the U.S. Supreme Court. The American Bar Association rated her well-qualified. President Clinton nominated her. And at her confirmation hearing she sat for two days and answered questions from the Senate Judiciary Committee with a precision and composure that made the committee look small. She was confirmed 96-3. She served until she was 87.",
    videoLabel: "What it looks like when someone has done the work.",
  },
  {
    videoId: 'zQucWXWXp3k',
    context:
      "Adele's live version of \"Someone Like You\" at the 2011 BRIT Awards. No backing track. No dancers. No production. Just a piano and a voice. Within thirty seconds the arena was completely still. She had written the song two days after a breakup, sitting on a kitchen floor. By the time she finished, the camera had cut to every person in the front row. They were all crying.",
    videoLabel: "A piano, a voice, and 20,000 people holding their breath.",
  },
  {
    videoId: 'Svj8JPxBMSc',
    context:
      "Diana Nyad swam from Cuba to Florida in 2013 — 110 miles through open ocean, no shark cage, through jellyfish that left burns across her face. She was 64 years old. It was her fifth attempt. When she walked out of the water in Key West after 53 hours, she could barely stand. She gave a speech anyway. \"You are never too old to chase your dream,\" she said. \"It looks like a solitary sport, but it's a team.\"",
    videoLabel: "64 years old. 110 miles. No cage. Fifth attempt.",
  },
];

// Pick the video story least recently used — avoids showing the same clip
// back-to-back. Falls back to modulo rotation if the archive has no videoId data.
function pickStory(archive, issueNum) {
  const recentVideoIds = new Set(
    archive.slice(0, TEARS_STORIES.length).map((e) => e.videoId).filter(Boolean)
  );
  const available = TEARS_STORIES.filter((s) => !recentVideoIds.has(s.videoId));
  if (available.length > 0) return available[0];
  return TEARS_STORIES[issueNum % TEARS_STORIES.length];
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function issueNumber(archive) {
  // Derive next issue number from the existing archive (max + 1)
  if (!archive || archive.length === 0) return 1;
  const max = Math.max(...archive.map((e) => e.issue || 0));
  return max + 1;
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

// ─── Content generation ───────────────────────────────────────────────────────

async function generateContent(date, story, recentIssues) {
  const client = new Anthropic();
  const dateStr = formatDate(date);
  const fourDaysAgo = formatDate(new Date(date.getTime() - 4 * 24 * 60 * 60 * 1000));

  // Build a "do not repeat" block from the last 10 issues
  const doNotRepeat = recentIssues && recentIssues.length > 0
    ? `\nRECENTLY COVERED — DO NOT USE ANY OF THESE:\nThe following brands, ingredients, designers, charities, and stories have already appeared in the last ${recentIssues.length} issues. You are BANNED from mentioning them again. A repeat is a firing offense.\n\n${recentIssues.map((iss, i) => `Issue ${i + 1} (${iss.date}): ${iss.preview}`).join('\n')}\n\nBefore writing anything, ask yourself: "Did any recent issue cover this brand, ingredient, designer, or charity?" If yes, choose something completely different. The reader sees every issue. They will notice.\n`
    : '';

  const prompt = `You are the editor of LIP SERVICE — a sharp, witty, beautifully written daily newsletter about beauty, fashion, culture, and the things women actually care about.

You are a working journalist with exacting standards. Your job is to find what is NEW and SPECIFIC today. You do not recycle stories. You do not reach for the same brands. You do not cover the same ingredient twice in a month. Every issue must feel like it was reported fresh that morning.

Voice: Personal, specific, slightly wry. Think a brilliant friend who reads PubMed AND sends the unhinged meme. Never condescending, never preachy. The kind of writing that makes you feel like you were let in on something.

JOURNALISTIC RULES — these are non-negotiable:
1. The brand drama must be a DIFFERENT brand every single issue. There are thousands of beauty brands. Use them.
2. The ingredient science must cover a DIFFERENT ingredient every issue. There are hundreds of actives. Pick one that hasn't been covered recently.
3. The runway moment must reference a DIFFERENT designer and collection every issue.
4. The charity must be a DIFFERENT organization every issue. Do not return to the same charity within 30 days.
5. If you find yourself writing about a brand, ingredient, or designer that feels familiar, STOP and choose something else.
6. Specific beats vague. A real brand name, a real product launch, a real controversy — not "a major beauty brand" or "a popular ingredient."

FRESHNESS RULE — this is the most important rule:
Every brand story, product launch, ingredient trend, runway moment, and charity spotlight you reference must have been publicly reported or occurred on or after ${fourDaysAgo}. Do not reference events, launches, controversies, or campaigns older than 4 days. If you are not certain something happened within that window, do not use it. Find something that did.
${doNotRepeat}
IMPORTANT: Never use the words "preview", "draft", or "test" anywhere in the content. Write as if this is the final published issue.

IMPORTANT: Never use an em dash (—) anywhere in the writing. Rewrite any sentence that would require one. Use a comma, a period, or restructure the sentence instead.

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

  // Update issues.json
  const issuesDir = path.join(__dirname, 'issues');
  await fs.mkdir(issuesDir, { recursive: true });
  const issuesJsonPath = path.join(__dirname, 'issues.json');
  let archive = [];
  try { archive = JSON.parse(await fs.readFile(issuesJsonPath, 'utf-8')); } catch {}
  const issueNum = parseInt((issueLabel.match(/\d+/) || ['0'])[0], 10);
  archive = archive.filter((e) => e.date !== key);
  archive.unshift({ issue: issueNum, date: key, title: issueLabel, preview: heroText, slug: key, url: `./issues/${key}.html`, videoId: meta.videoId });
  await fs.writeFile(issuesJsonPath, JSON.stringify(archive, null, 2), 'utf-8');

  // Strip preview nav bar, replace archive placeholder with nothing (inbox-only)
  const cleanHtml = previewHtml.replace(/<div class="issue-nav-bar"[^>]*>[\s\S]*?<\/div>\n?/, '');
  const newsletterHtml = cleanHtml
    .replace(PREVIEW_PLACEHOLDER, '')
    .replace(/\{\{ROOT\}\}/g, '');
  await fs.writeFile(path.join(__dirname, 'newsletter.html'), newsletterHtml, 'utf-8');
  await fs.writeFile(path.join(__dirname, 'index.html'), newsletterHtml, 'utf-8');
  console.log(`  ✓ newsletter.html + index.html (${issueLabel})`);

  // Write individual issue file (required for idempotency check on retry crons)
  await fs.writeFile(path.join(issuesDir, `${key}.html`), newsletterHtml, 'utf-8');
  console.log(`  ✓ issues/${key}.html`);

  console.log(`  ✓ issues.json (${archive.length} issue${archive.length !== 1 ? 's' : ''})`);

  // Clean up preview/ and stage the deletion in git so manual runs don't leave dirty state.
  // In CI the workflow's `git add -A` would catch it anyway; this makes local runs clean too.
  await fs.rm(previewDir, { recursive: true });
  try {
    execSync('git rm -rf --cached --ignore-unmatch preview/', { cwd: __dirname, stdio: 'pipe' });
  } catch { /* not a git repo or nothing tracked — CI's git add -A will handle it */ }
  console.log('  ✓ preview/ cleaned up');
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

  const issueDate = formatDate(today);
  const key = dateKey(today);

  // Read existing archive first so we can derive the next issue number,
  // then use issueNum to select the image/story (avoids day-based repeats).
  const issuesJsonPath = path.join(__dirname, 'issues.json');
  let archive = [];
  try { archive = JSON.parse(await fs.readFile(issuesJsonPath, 'utf-8')); } catch {}

  const issueNum = issueNumber(archive.filter((e) => e.date !== key));

  const image = BEAUTY_IMAGES[issueNum % BEAUTY_IMAGES.length];
  const story = pickStory(archive.filter((e) => e.date !== key), issueNum);
  const issueLabel = `Issue No. ${issueNum}`;

  // Pass the last 10 issues so Claude knows what NOT to repeat
  const recentIssues = archive
    .filter((e) => e.date !== key)
    .slice(0, 10)
    .map((e) => ({ date: e.date, preview: e.preview }));

  console.log(`${PREVIEW_MODE ? 'Previewing' : 'Generating'} ${issueLabel} — ${issueDate}`);
  if (recentIssues.length > 0) {
    console.log(`  Passing ${recentIssues.length} recent issues to avoid repeats`);
  }

  const content = await generateContent(today, story, recentIssues);
  const template = await fs.readFile(path.join(__dirname, 'template.html'), 'utf-8');
  const html = renderHtml(template, content, image, story, issueLabel, issueDate);

  if (PREVIEW_MODE) {
    // ── Write preview/ (no changes to live site) ───────────────────────────
    const previewDir = path.join(__dirname, 'preview');

    // Idempotency: skip if a preview already exists for the same target date.
    // Prevents the duplicate preview crons (5 UTC and 6 UTC) from both calling the API.
    try {
      const existingMeta = JSON.parse(await fs.readFile(path.join(previewDir, 'meta.json'), 'utf-8'));
      if (existingMeta.date === key) {
        console.log(`Preview already exists for ${key} (${issueLabel}), skipping.`);
        return;
      }
    } catch { /* no existing preview — proceed */ }
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
      { date: key, issueLabel, issueDate, heroText: content.hero_text, videoId: story.videoId }, null, 2
    ), 'utf-8');
    console.log(`  ✓ preview/index.html (${issueLabel}) — live at /preview/`);
  } else {
    // ── Normal publish: write newsletter.html + issues.json ───────────────
    const issuesDir = path.join(__dirname, 'issues');
    await fs.mkdir(issuesDir, { recursive: true });

    archive = archive.filter((e) => e.date !== key);
    archive.unshift({ issue: issueNum, date: key, title: issueLabel, preview: content.hero_text, slug: key, url: `./issues/${key}.html`, videoId: story.videoId });
    await fs.writeFile(issuesJsonPath, JSON.stringify(archive, null, 2), 'utf-8');

    const newsletterHtml = html
      .replace('{{ARCHIVE_SECTION}}', '')
      .replace(/\{\{ROOT\}\}/g, '');
    await fs.writeFile(path.join(__dirname, 'newsletter.html'), newsletterHtml, 'utf-8');
    await fs.writeFile(path.join(__dirname, 'index.html'), newsletterHtml, 'utf-8');
    console.log(`  ✓ newsletter.html + index.html (${issueLabel})`);

    // Write individual issue file (required for idempotency check on retry crons)
    await fs.writeFile(path.join(issuesDir, `${key}.html`), newsletterHtml, 'utf-8');
    console.log(`  ✓ issues/${key}.html`);

    console.log(`  ✓ issues.json (${archive.length} issue${archive.length !== 1 ? 's' : ''})`);
  }
}

main().catch((err) => {
  console.error('Generation failed:', err.message);
  process.exit(1);
});
