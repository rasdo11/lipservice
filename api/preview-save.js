import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getFile, putFile } from './_github.js';
import { renderHtml } from '../lib/render.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREVIEW_PLACEHOLDER = '<!-- ARCHIVE_SECTION_PREVIEW_PLACEHOLDER -->';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, content } = req.body || {};

  // Auth
  const editToken = process.env.PREVIEW_EDIT_TOKEN;
  if (!editToken || token !== editToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validate content
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return res.status(400).json({ error: 'content must be a JSON object' });
  }

  try {
    // Read current content.json to get metadata + SHA
    const { content: rawJson, sha: contentSha } = await getFile('preview/content.json');
    if (!rawJson || contentSha === null) {
      return res.status(404).json({ error: 'No active preview found' });
    }

    let stored;
    try {
      stored = JSON.parse(rawJson);
    } catch {
      return res.status(500).json({ error: 'Stored content.json is malformed' });
    }

    const { image, issueLabel, issueDate, issueUrl, date } = stored;

    // Read template
    const template = await fs.readFile(path.join(__dirname, '..', 'template.html'), 'utf-8');

    // Re-render with edited content
    const html = renderHtml(template, content, image, issueLabel, issueDate, issueUrl);

    const previewNavBar = `<div class="issue-nav-bar" style="background:var(--rouge);color:#fff;">
  <span>👁 PREVIEW — goes live at 6am PST</span>
  <span>${issueLabel} &middot; ${issueDate}</span>
</div>`;
    const previewHtml = html
      .replace('<div class="email-wrapper">', `${previewNavBar}\n<div class="email-wrapper">`)
      .replace('{{ARCHIVE_SECTION}}', PREVIEW_PLACEHOLDER)
      .replace(/\{\{ROOT\}\}/g, '../');

    // Save updated content.json
    const updatedContentJson = JSON.stringify(
      { content, image, issueLabel, issueDate, issueUrl, date },
      null,
      2
    );
    await putFile('preview/content.json', updatedContentJson, contentSha, 'edit preview content');

    // Save updated index.html
    const { sha: indexSha } = await getFile('preview/index.html');
    await putFile('preview/index.html', previewHtml, indexSha, 'edit preview content');

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('preview-save error:', err.message);
    return res.status(500).json({ error: 'Failed to save' });
  }
}
