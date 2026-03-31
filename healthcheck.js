import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REQUIRED_PLACEHOLDERS = [
  '{{ISSUE_LABEL}}',
  '{{ISSUE_DATE}}',
  '{{BUT_FIRST}}',
  '{{QUOTE_TEXT}}',
  '{{QUOTE_ATTRIBUTION}}',
  '{{INJECTION_HEADLINE}}',
  '{{INJECTION_BODY}}',
  '{{INJECTION_HIGHLIGHT}}',
  '{{INJECTION_RELATED}}',
  '{{ROTATION_1_ITEMS}}',
  '{{PIYM_HEADLINE}}',
  '{{PIYM_BODY}}',
  '{{PIYM_HIGHLIGHT}}',
  '{{PIYM_CHEAT_MEAL}}',
  '{{PIYM_RELATED}}',
  '{{LIP_LAB_HEADLINE}}',
  '{{LIP_LAB_BODY}}',
  '{{LIP_LAB_HIGHLIGHT}}',
  '{{LIP_LAB_RELATED}}',
  '{{SEE_IMAGE_URL}}',
  '{{SEE_IMAGE_ALT}}',
  '{{LIPS_IN_6_ITEMS}}',
  '{{QUICK_HITS_ITEMS}}',
  '{{CALENDAR_ITEMS}}',
  '{{ROTATION_2_ITEMS}}',
  '{{LAST_WORD_QUOTE}}',
  '{{LAST_WORD_ATTRIBUTION}}',
];

export async function runHealthCheck() {
  const failures = [];

  console.log('Running pre-generation health check...');

  // 1. Anthropic API key
  if (!process.env.ANTHROPIC_API_KEY) {
    failures.push('ANTHROPIC_API_KEY is not set');
  } else if (!process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
    failures.push('ANTHROPIC_API_KEY looks malformed (expected sk-ant- prefix)');
  }

  // 2. template.html — exists and has all required placeholders
  const templatePath = path.join(__dirname, 'template.html');
  try {
    const template = await fs.readFile(templatePath, 'utf-8');
    const missing = REQUIRED_PLACEHOLDERS.filter((p) => !template.includes(p));
    if (missing.length > 0) {
      failures.push(`template.html is missing placeholders: ${missing.join(', ')}`);
    }
  } catch {
    failures.push('template.html not found');
  }

  // 3. issues.json — exists and is valid JSON array
  const issuesPath = path.join(__dirname, 'issues.json');
  try {
    const raw = await fs.readFile(issuesPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      failures.push('issues.json is not a JSON array');
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      // First issue — no archive yet, that's fine
    } else {
      failures.push(`issues.json is invalid JSON: ${err.message}`);
    }
  }

  // 4. issues/ directory is writable
  const issuesDir = path.join(__dirname, 'issues');
  try {
    await fs.mkdir(issuesDir, { recursive: true });
    const testFile = path.join(issuesDir, '.write-test');
    await fs.writeFile(testFile, '');
    await fs.rm(testFile);
  } catch {
    failures.push('issues/ directory is not writable');
  }

  if (failures.length > 0) {
    console.error('\nHealth check FAILED:');
    failures.forEach((f) => console.error(`  ✗ ${f}`));
    console.error('');
    process.exit(1);
  }

  console.log('  ✓ API key present');
  console.log('  ✓ template.html valid');
  console.log('  ✓ issues.json valid');
  console.log('  ✓ filesystem writable');
}
