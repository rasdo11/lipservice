import { getFile, putFile, csvQuote } from './_github.js';

const FILE = 'subscribers.csv';
const HEADER = 'timestamp,firstName,email,source\n';

const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
const BEEHIIV_PUB_ID = process.env.BEEHIIV_PUBLICATION_ID || 'pub_b33a3dc2-5d4a-42e4-b08d-284e84b97b54';

async function addToBeehiiv(email, firstName) {
  if (!BEEHIIV_API_KEY) return;
  try {
    const body = {
      email,
      reactivate_existing: false,
      send_welcome_email: true,
      utm_source: 'website',
    };
    if (firstName) {
      body.custom_fields = [{ name: 'first_name', value: firstName }];
    }
    const resp = await fetch(
      `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/subscriptions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BEEHIIV_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
    if (!resp.ok) {
      const text = await resp.text();
      console.error(`beehiiv subscribe error ${resp.status}:`, text);
    }
  } catch (err) {
    console.error('beehiiv subscribe error:', err.message);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { firstName = '', email = '', source = 'unknown' } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const row = [new Date().toISOString(), firstName, email, source].map(csvQuote).join(',') + '\n';

  try {
    const { content, sha } = await getFile(FILE, HEADER);
    const updated = content.endsWith('\n') ? content + row : content + '\n' + row;
    await putFile(FILE, updated, sha, `subscriber: ${email}`);
  } catch (err) {
    console.error('subscribe error:', err.message);
    return res.status(500).json({ error: 'Failed to save' });
  }

  await addToBeehiiv(email, firstName);

  return res.status(200).json({ ok: true });
}
