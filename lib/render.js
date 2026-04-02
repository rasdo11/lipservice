// ─── Shared render utilities ─────────────────────────────────────────────────
// Used by both generate.js and api/preview-save.js. Pure functions — no
// filesystem access, no side effects.

export function markdownBoldToHtml(text) {
  if (!text) return '';
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

export function buildBodyHtml(text) {
  if (!text) return '';
  // Ensure beat labels (**Label:**) always open a new paragraph regardless of
  // whether Claude included a blank line before them in the JSON body text.
  const normalized = text.replace(/([^\n])(\s*\*\*[^*]+:\*\*)/g, '$1\n\n$2');
  const converted = markdownBoldToHtml(normalized);
  if (converted.includes('<p')) return converted;
  return converted
    .split(/\n\n+/)
    .map((p) => `<p>${p.trim()}</p>`)
    .join('\n');
}

export function buildLipsIn6Html(items) {
  return items
    .map(
      (item) =>
        `<div class="lips-item"><span class="lips-emoji">${item.emoji}</span><span class="lips-text">${markdownBoldToHtml(item.text)}</span></div>`
    )
    .join('\n');
}

export function buildQuickHitsHtml(items) {
  return items
    .map((item) => {
      const labelHtml = item.label
        ? `<span class="qh-label">${item.label}:</span> `
        : '';
      return `<div class="quick-hit-item"><span class="qh-emoji">${item.emoji}</span><span class="qh-body">${labelHtml}${markdownBoldToHtml(item.text)}</span></div>`;
    })
    .join('\n');
}

export function buildRotationHtml(items) {
  return items
    .map(
      (item) =>
        `<div class="rotation-item">${markdownBoldToHtml(item.text)}</div>`
    )
    .join('\n');
}

export function buildCalendarHtml(items) {
  return items
    .map(
      (item) =>
        `<div class="calendar-item"><span class="cal-emoji">${item.emoji}</span><span class="cal-text">${markdownBoldToHtml(item.text)}</span></div>`
    )
    .join('\n');
}

export function buildOgMeta(issueLabel, previewText, issueUrl) {
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

export function renderHtml(template, content, image, issueLabel, issueDate, issueUrl) {
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
