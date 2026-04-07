#!/usr/bin/env python3
"""
Lip Service — Issue Publisher
Promotes a previewed issue from preview/ to issues/ and updates issues.json.

No API calls. Reads preview/meta.json, moves files, updates index.

Run after generate.py has run in preview mode.
"""

import json
import os
import shutil
import sys
from pathlib import Path


def main():
    repo_root = Path(__file__).parent.parent.parent
    preview_dir = repo_root / 'preview'
    issues_dir = repo_root / 'issues'
    issues_json_path = repo_root / 'issues.json'
    meta_path = preview_dir / 'meta.json'

    # Check for preview to publish
    if not meta_path.exists():
        print('ℹ️  No preview/meta.json found — nothing to publish.')
        sys.exit(0)

    try:
        meta = json.loads(meta_path.read_text(encoding='utf-8'))
    except (json.JSONDecodeError, ValueError) as e:
        print(f'ERROR: Could not parse preview/meta.json: {e}', file=sys.stderr)
        sys.exit(1)

    issue_number = meta.get('issue')
    slug = meta.get('slug')
    title = meta.get('title', f'Issue {issue_number}')

    if not issue_number or not slug:
        print('ERROR: preview/meta.json is missing "issue" or "slug" fields.', file=sys.stderr)
        sys.exit(1)

    preview_html_path = preview_dir / f'{slug}.html'
    if not preview_html_path.exists():
        print(f'ERROR: Expected preview file not found: {preview_html_path}', file=sys.stderr)
        sys.exit(1)

    # Promote HTML to issues/
    issues_dir.mkdir(exist_ok=True)
    dest_path = issues_dir / f'{slug}.html'
    shutil.copy2(preview_html_path, dest_path)
    print(f'✓ Moved: {preview_html_path} → {dest_path}')

    # Update issues.json
    if issues_json_path.exists():
        try:
            issues = json.loads(issues_json_path.read_text(encoding='utf-8'))
        except (json.JSONDecodeError, ValueError):
            issues = []
    else:
        issues = []

    # Remove any existing entry for this issue number, then prepend
    issues = [e for e in issues if e.get('issue') != issue_number]
    issues.insert(0, meta)
    issues_json_path.write_text(
        json.dumps(issues, indent=2, ensure_ascii=False),
        encoding='utf-8',
    )
    print(f'✓ issues.json updated (issue #{issue_number} prepended)')

    # Update index.html and newsletter.html with latest issue
    index_path = repo_root / 'index.html'
    shutil.copy2(dest_path, index_path)
    print(f'✓ index.html updated')
    newsletter_path = repo_root / 'newsletter.html'
    shutil.copy2(dest_path, newsletter_path)
    print(f'✓ newsletter.html updated')

    # Clean up preview files
    preview_html_path.unlink()
    meta_path.unlink()
    print('✓ Preview files cleaned up')

    print(f'\n✓ Published issue #{issue_number}: {title}')

    # Write GitHub Actions outputs
    github_output = os.environ.get('GITHUB_OUTPUT', '')
    if github_output:
        with open(github_output, 'a', encoding='utf-8') as f:
            f.write(f'ISSUE_TITLE={title}\n')
            f.write(f'ISSUE_NUMBER={issue_number}\n')


if __name__ == '__main__':
    main()
