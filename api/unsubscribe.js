import { getFile, putFile, csvQuote } from './_github.js';

const FILE = 'unsubscribes.csv';
const HEADER = 'timestamp,email\n';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email = '' } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const row = [new Date().toISOString(), email].map(csvQuote).join(',') + '\n';

  try {
    const { content, sha } = await getFile(FILE, HEADER);
    const updated = content.endsWith('\n') ? content + row : content + '\n' + row;
    await putFile(FILE, updated, sha, `unsubscribe: ${email}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('unsubscribe error:', err.message);
    return res.status(500).json({ error: 'Failed to save' });
  }
}
