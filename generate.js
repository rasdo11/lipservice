import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHealthCheck } from './healthcheck.js';

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

function markdownBoldToHtml(text) {
  if (!text) return '';
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

function buildBodyHtml(text) {
  if (!text) return '';
  const converted = markdownBoldToHtml(text);
  if (converted.includes('<p')) return converted;
  return converted
    .split(/\n\n+/)
    .map((p) => `<p>${p.trim()}</p>`)
    .join('\n');
}

function buildLipsIn6Html(items) {
  return items
    .map(
      (item) =>
        `<div class="lips-item"><span class="lips-emoji">${item.emoji}</span><span class="lips-text">${markdownBoldToHtml(item.text)}</span></div>`
    )
    .join('\n');
}

function buildQuickHitsHtml(items) {
  return items
    .map((item) => {
      const labelHtml = item.label
        ? `<span class="qh-label">${item.label}:</span> `
        : '';
      return `<div class="quick-hit-item"><span class="qh-emoji">${item.emoji}</span><span class="qh-body">${labelHtml}${markdownBoldToHtml(item.text)}</span></div>`;
    })
    .join('\n');
}

function buildRotationHtml(items) {
  return items
    .map(
      (item) =>
        `<div class="rotation-item">${markdownBoldToHtml(item.text)}</div>`
    )
    .join('\n');
}

function buildCalendarHtml(items) {
  return items
    .map(
      (item) =>
        `<div class="calendar-item"><span class="cal-emoji">${item.emoji}</span><span class="cal-text">${markdownBoldToHtml(item.text)}</span></div>`
    )
    .join('\n');
}

// ─── Content generation ───────────────────────────────────────────────────────

async function generateContent(date, recentIssues) {
  const client = new Anthropic();
  const dateStr = formatDate(date);
  const fourDaysAgo = formatDate(new Date(date.getTime() - 4 * 24 * 60 * 60 * 1000));

  // Load the editorial style guide as the system prompt
  const systemPrompt = await fs.readFile(
    path.join(__dirname, '.github', 'prompts', 'system.md'),
    'utf-8'
  );

  // Build a "do not repeat" block from the last 10 issues
  const doNotRepeat =
    recentIssues && recentIssues.length > 0
      ? `RECENTLY COVERED — DO NOT USE ANY OF THESE:\nThe following brands, ingredients, designers, charities, and stories have already appeared in the last ${recentIssues.length} issues. You are BANNED from mentioning them again. A repeat is a firing offense.\n\n${recentIssues.map((iss, i) => `Issue ${i + 1} (${iss.date}): ${iss.preview}`).join('\n')}\n\nBefore writing anything, ask yourself: "Did any recent issue cover this brand, ingredient, designer, or charity?" If yes, choose something completely different. The reader sees every issue. They will notice.\n`
      : '';

  const userPrompt = `Today is ${dateStr}. The freshness window is ${fourDaysAgo} through today — every news peg must fall within that window.

${doNotRepeat}IMPORTANT: Never use an em dash (—) anywhere in the writing. Rewrite any sentence that would require one. Use a comma, a period, or restructure the sentence instead.

IMPORTANT: Never use the words "preview", "draft", or "test" anywhere in the content. Write as if this is the final published issue.

Return only valid, parseable JSON matching the schema in your instructions. No markdown fences, no explanation, no trailing commas.`;

  console.log('Calling Claude API...');

  const stream = client.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
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

function buildOgMeta(issueLabel, previewText, issueUrl) {
  const desc = previewText.replace(/"/g, '&quot;').replace(/\n/g, ' ').slice(0, 300);
  const title = `Lip Service — ${issueLabel}`;
  return [
    `<meta property="og:type" content="article">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${desc}">`,
    issueUrl ? `<meta property="og:url" content="${issueUrl}">` : '',
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${desc}">`,
  ]
    .filter(Boolean)
    .join('\n');
}

function renderHtml(template, content, image, issueLabel, issueDate, issueUrl) {
  return template
    .replace(/\{\{ISSUE_LABEL\}\}/g, issueLabel)
    .replace(/\{\{ISSUE_DATE\}\}/g, issueDate)
    .replace('{{OG_META}}', buildOgMeta(issueLabel, content.preview || content.but_first, issueUrl))
    .replace('{{ISSUE_URL}}', issueUrl || '#')
    .replace('{{BUT_FIRST}}', content.but_first)
    .replace('{{QUOTE_TEXT}}', content.quote_of_day.text)
    .replace('{{QUOTE_ATTRIBUTION}}', content.quote_of_day.attribution)
    .replace('{{INJECTION_HEADLINE}}', content.injection_report.headline)
    .replace('{{INJECTION_BODY}}', buildBodyHtml(content.injection_report.body))
    .replace('{{INJECTION_HIGHLIGHT}}', content.injection_report.highlight)
    .replace('{{INJECTION_RELATED}}', content.injection_report.related)
    .replace('{{ROTATION_1_ITEMS}}', buildRotationHtml(content.rotation_1))
    .replace('{{PIYM_HEADLINE}}', content.put_it_in_your_mouth.headline)
    .replace('{{PIYM_BODY}}', buildBodyHtml(content.put_it_in_your_mouth.body))
    .replace('{{PIYM_HIGHLIGHT}}', content.put_it_in_your_mouth.highlight)
    .replace('{{PIYM_CHEAT_MEAL}}', content.put_it_in_your_mouth.cheat_meal)
    .replace('{{PIYM_RELATED}}', content.put_it_in_your_mouth.related)
    .replace('{{LIP_LAB_HEADLINE}}', content.lip_lab.headline)
    .replace('{{LIP_LAB_BODY}}', buildBodyHtml(content.lip_lab.body))
    .replace('{{LIP_LAB_HIGHLIGHT}}', content.lip_lab.highlight)
    .replace('{{LIP_LAB_RELATED}}', content.lip_lab.related)
    .replace('{{SEE_IMAGE_URL}}', `https://images.unsplash.com/photo-${image.photoId}?w=600&q=80`)
    .replace('{{SEE_IMAGE_ALT}}', image.alt)
    .replace('{{LIPS_IN_6_ITEMS}}', buildLipsIn6Html(content.lips_in_6))
    .replace('{{QUICK_HITS_ITEMS}}', buildQuickHitsHtml(content.quick_hits))
    .replace('{{CALENDAR_ITEMS}}', buildCalendarHtml(content.on_our_calendar))
    .replace('{{ROTATION_2_ITEMS}}', buildRotationHtml(content.rotation_2))
    .replace('{{LAST_WORD_QUOTE}}', content.last_word.quote)
    .replace('{{LAST_WORD_ATTRIBUTION}}', content.last_word.attribution);
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
  try {
    archive = JSON.parse(await fs.readFile(issuesJsonPath, 'utf-8'));
  } catch {}
  const issueNum = parseInt((issueLabel.match(/\d+/) || ['0'])[0], 10);
  archive = archive.filter((e) => e.date !== key);
  archive.unshift({
    issue: issueNum,
    date: key,
    title: issueLabel,
    preview: heroText,
    slug: key,
    url: `./issues/${key}.html`,
  });
  archive.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  await fs.writeFile(issuesJsonPath, JSON.stringify(archive, null, 2), 'utf-8');

  // Strip preview nav bar, replace archive placeholder with nothing (inbox-only)
  const cleanHtml = previewHtml.replace(
    /<div class="issue-nav-bar"[^>]*>[\s\S]*?<\/div>\n?/,
    ''
  );
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
  await fs.rm(previewDir, { recursive: true });
  try {
    execSync('git rm -rf --cached --ignore-unmatch preview/', {
      cwd: __dirname,
      stdio: 'pipe',
    });
  } catch {
    /* not a git repo or nothing tracked — CI's git add -A will handle it */
  }
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

    // Hold check: if preview/hold exists, editor has flagged this issue — skip publish
    const holdFile = path.join(__dirname, 'preview', 'hold');
    try {
      await fs.access(holdFile);
      console.log('Issue is on hold (preview/hold exists). Skipping publish. Remove the hold file to release.');
      return;
    } catch {}

    let previewExists = false;
    try {
      await fs.access(path.join(__dirname, 'preview', 'index.html'));
      previewExists = true;
    } catch {}
    if (previewExists) {
      await promotePreview();
      return;
    }
    console.log('No preview found — generating fresh...');
  }

  // ── Health check (preview mode only — catches config issues before API call) ─
  if (PREVIEW_MODE) {
    await runHealthCheck();
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
  try {
    archive = JSON.parse(await fs.readFile(issuesJsonPath, 'utf-8'));
  } catch {}

  const issueNum = issueNumber(archive.filter((e) => e.date !== key));

  const image = BEAUTY_IMAGES[issueNum % BEAUTY_IMAGES.length];
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

  const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '');
  const issueUrl = siteUrl ? `${siteUrl}/issues/${key}.html` : `./issues/${key}.html`;

  const content = await generateContent(today, recentIssues);
  const template = await fs.readFile(path.join(__dirname, 'template.html'), 'utf-8');
  const html = renderHtml(template, content, image, issueLabel, issueDate, issueUrl);

  if (PREVIEW_MODE) {
    // ── Write preview/ (no changes to live site) ───────────────────────────
    const previewDir = path.join(__dirname, 'preview');

    // Idempotency: skip if a preview already exists for the same target date.
    // Prevents the duplicate preview crons (5 UTC and 6 UTC) from both calling the API.
    try {
      const existingMeta = JSON.parse(
        await fs.readFile(path.join(previewDir, 'meta.json'), 'utf-8')
      );
      if (existingMeta.date === key) {
        console.log(`Preview already exists for ${key} (${issueLabel}), skipping.`);
        return;
      }
    } catch {
      /* no existing preview — proceed */
    }
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
    await fs.writeFile(
      path.join(previewDir, 'meta.json'),
      JSON.stringify(
        { date: key, issueLabel, issueDate, heroText: content.preview || content.but_first },
        null,
        2
      ),
      'utf-8'
    );
    console.log(`  ✓ preview/index.html (${issueLabel}) — live at /preview/`);
  } else {
    // ── Normal publish: write newsletter.html + issues.json ───────────────
    const issuesDir = path.join(__dirname, 'issues');
    await fs.mkdir(issuesDir, { recursive: true });

    archive = archive.filter((e) => e.date !== key);
    archive.unshift({
      issue: issueNum,
      date: key,
      title: issueLabel,
      preview: content.preview || content.but_first,
      slug: key,
      url: `./issues/${key}.html`,
    });
    archive.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
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
