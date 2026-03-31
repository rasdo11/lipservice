import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getFile, putFile } from './_github.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, id, action } = req.body || {};

  const editToken = process.env.PREVIEW_EDIT_TOKEN;
  if (!editToken || token !== editToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!id || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'id and action (approve|reject) required' });
  }

  try {
    // Read proposals.json
    const { content: rawProposals, sha: proposalsSha } = await getFile('structure/proposals.json');
    if (!rawProposals) return res.status(404).json({ error: 'proposals.json not found' });

    let proposals;
    try { proposals = JSON.parse(rawProposals); } catch {
      return res.status(500).json({ error: 'proposals.json is malformed' });
    }

    const proposal = proposals.find(p => p.id === id);
    if (!proposal) return res.status(404).json({ error: `Proposal '${id}' not found` });
    if (proposal.status !== 'draft') {
      return res.status(409).json({ error: `Proposal is already ${proposal.status}` });
    }

    if (action === 'reject') {
      proposal.status = 'rejected';
      await putFile(
        'structure/proposals.json',
        JSON.stringify(proposals, null, 2),
        proposalsSha,
        `structure: reject proposal '${id}'`
      );
      return res.status(200).json({ ok: true });
    }

    // action === 'approve': apply changes to template.html
    const { content: templateHtml, sha: templateSha } = await getFile('template.html');
    if (!templateHtml) return res.status(500).json({ error: 'template.html not found' });

    let updatedTemplate = templateHtml;

    // Apply CSS: append before closing </style>
    if (proposal.css) {
      updatedTemplate = updatedTemplate.replace(
        '</style>',
        `\n  /* === ${proposal.id} === */\n  ${proposal.css.replace(/\n/g, '\n  ')}\n</style>`
      );
    }

    // Apply HTML: replace the data-section block
    if (proposal.html && proposal.section !== 'all') {
      const section = proposal.section;
      // Match the opening tag with data-section="X" through the matching closing </div>
      // Uses a simple stack-based replacement via regex on the serialised template
      const openRe = new RegExp(
        `(<(?:div)[^>]*data-section="${section}"[^>]*>)([\\s\\S]*?)(?=\\n\\n  <!-- |\\n\\n  \\{\\{ARCHIVE|$)`,
        'i'
      );
      const replaced = updatedTemplate.replace(openRe, proposal.html);
      if (replaced !== updatedTemplate) {
        updatedTemplate = replaced;
      }
    }

    // Mark approved
    proposal.status = 'approved';

    // Write both files
    await putFile(
      'template.html',
      updatedTemplate,
      templateSha,
      `structure: approve proposal '${id}'`
    );
    await putFile(
      'structure/proposals.json',
      JSON.stringify(proposals, null, 2),
      proposalsSha,
      `structure: mark proposal '${id}' approved`
    );

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('structure-approve error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed' });
  }
}
