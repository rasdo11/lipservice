/**
 * Places a hold on the current preview, preventing it from auto-publishing.
 * Run: npm run hold
 * To release: npm run unhold
 */
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOLD_FILE = path.join(__dirname, 'preview', 'hold');
const RELEASE = process.argv[2] === '--release';

async function main() {
  const previewDir = path.join(__dirname, 'preview');

  // Check preview exists
  try {
    await fs.access(path.join(previewDir, 'index.html'));
  } catch {
    console.error('No preview found at preview/index.html. Nothing to hold.');
    process.exit(1);
  }

  if (RELEASE) {
    try {
      await fs.rm(HOLD_FILE);
      execSync('git rm -f --cached --ignore-unmatch preview/hold', { cwd: __dirname, stdio: 'pipe' });
      execSync('git add -A && git commit -m "release hold on preview" && git push origin HEAD', {
        cwd: __dirname,
        stdio: 'inherit',
      });
      console.log('Hold released. The next publish cron will promote the preview.');
    } catch (err) {
      console.error('Failed to release hold:', err.message);
      process.exit(1);
    }
    return;
  }

  // Place hold
  await fs.mkdir(previewDir, { recursive: true });
  await fs.writeFile(HOLD_FILE, `held at ${new Date().toISOString()}\n`, 'utf-8');

  try {
    execSync('git add preview/hold && git commit -m "hold: pause auto-publish for editor review" && git push origin HEAD', {
      cwd: __dirname,
      stdio: 'inherit',
    });
    console.log('\nHold placed. This issue will NOT auto-publish until the hold is released.');
    console.log('To release: npm run unhold\n');
  } catch (err) {
    console.error('Hold file created locally but git push failed:', err.message);
    console.log('You may need to commit and push preview/hold manually.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
