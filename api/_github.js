// Shared GitHub file read/write helpers for serverless functions

export async function getFile(filePath, header) {
  const { GITHUB_TOKEN, GITHUB_REPO } = process.env;
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (res.status === 404) return { content: header, sha: null };
  if (!res.ok) throw new Error(`GitHub GET ${res.status}`);
  const data = await res.json();
  return {
    content: Buffer.from(data.content, 'base64').toString('utf-8'),
    sha: data.sha,
  };
}

export async function putFile(filePath, content, sha, message) {
  const { GITHUB_TOKEN, GITHUB_REPO } = process.env;
  const body = { message, content: Buffer.from(content).toString('base64') };
  if (sha) body.sha = sha;
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub PUT ${res.status}: ${err.message || ''}`);
  }
}

export function csvQuote(val) {
  return `"${String(val ?? '').replace(/"/g, '""').replace(/[\n\r]/g, ' ').slice(0, 300)}"`;
}
