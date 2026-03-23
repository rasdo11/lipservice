#!/usr/bin/env node
/**
 * daily-briefing.mjs
 * Supplement Agents — Daily Autonomous Research Briefing
 *
 * Runs two AI research agents (Sourcing Agent + Formulation Scientist) via
 * the Anthropic API with web search, then emails the combined briefing via
 * Resend to ross@withratio.com. If RESEND_API_KEY is not set the briefing is
 * printed to stdout instead (useful for local testing & GitHub Actions logs).
 */

// ─── Config ──────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const RESEND_API_KEY    = process.env.RESEND_API_KEY;
const TO_EMAIL          = process.env.ROSS_EMAIL || 'ross@withratio.com';
const FROM_EMAIL        = 'briefing@withratio.com'; // must be a verified Resend sender

if (!ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY is not set.');
  process.exit(1);
}

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
const MODEL          = 'claude-opus-4-5'; // supports web_search tool

// ─── Day-of-week topic rotation ──────────────────────────────────────────────

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SOURCING_TOPICS = {
  0: 'Alternative manufacturer discovery — find new contract manufacturers (beyond Makers Nutrition, NutraScience Labs, Vitalpax) that can handle small-batch capsule production of creatine monohydrate + magnesium glycinate with MOQs under 2,000 units.',
  1: 'Manufacturer intel — research current status, reviews, lead times, and any recent news about these three contract manufacturers: Makers Nutrition (Commack NY, phone 1-844-625-3771), NutraScience Labs (Farmingdale NY, info@nutrasciencelabs.com), Vitalpax (LaVerkin UT, info@vitalpax.com).',
  2: 'Contract manufacturing pricing and MOQ data — find current market pricing for capsule contract manufacturing, minimum order quantities, setup fees, and unit economics for a creatine + magnesium glycinate capsule product at 500–2,000 unit volumes.',
  3: 'Raw material costs — research current wholesale prices for pharmaceutical-grade creatine monohydrate and magnesium glycinate, key suppliers, and any supply chain issues or price trends.',
  4: 'Competitor DTC supplement analysis — research direct-to-consumer supplement brands selling creatine or magnesium glycinate targeting women 30–45. Focus on pricing, positioning, claims, and what\'s working.',
  5: 'Lead time intelligence — research typical lead times for contract-manufactured supplement capsules from formulation approval to finished goods. What\'s realistic for a first run of 500–1,500 units?',
  6: 'Amazon competitive landscape — research top-selling creatine monohydrate and magnesium glycinate products on Amazon, with focus on women\'s wellness positioning, pricing, review counts, and BSR rankings.',
};

const SCIENTIST_TOPICS = {
  0: 'Competitive formulation analysis — analyze the formulations of the top 10 creatine or magnesium glycinate supplements targeting women. What doses, forms, and combinations are they using? What claims do they make?',
  1: 'Creatine stability science — research whether "freshness" is a defensible differentiator for creatine monohydrate. Does creatine degrade over time? What do studies say about shelf life, degradation to creatinine, and storage conditions?',
  2: 'Magnesium form comparison — deep dive into magnesium glycinate vs. magnesium threonate vs. magnesium citrate vs. magnesium malate. Compare bioavailability, clinical evidence, cost, and which is best for cognitive function and sleep in women.',
  3: 'Dosing optimization for non-athletic populations — research optimal creatine and magnesium glycinate doses for women 30–45 who are not competitive athletes but want cognitive, energy, and longevity benefits. What does the evidence say?',
  4: 'Synergy ingredients — what third ingredient would most complement creatine monohydrate + magnesium glycinate for women\'s cognitive performance, energy, and longevity? Research the evidence for candidates like taurine, lion\'s mane, CoQ10, B6, etc.',
  5: 'FDA claims and regulatory landscape — what structure/function claims can legally be made for creatine monohydrate and magnesium glycinate? What claims are off-limits? Any recent FDA warning letters or enforcement actions in this space?',
  6: 'Women\'s health research on creatine — compile recent clinical research (2020–2025) on creatine supplementation specifically in women. Focus on cognitive benefits, bone health, muscle preservation, hormonal interactions, and any safety concerns.',
};

// ─── Anthropic API call with web search ──────────────────────────────────────

async function runAgent(systemPrompt, userPrompt, agentName) {
  console.log(`\n[${agentName}] Starting research...`);

  const body = {
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
      },
    ],
    messages: [
      { role: 'user', content: userPrompt },
    ],
  };

  let response = await fetch(`${ANTHROPIC_BASE}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type':         'application/json',
      'x-api-key':            ANTHROPIC_API_KEY,
      'anthropic-version':    '2023-06-01',
      'anthropic-beta':       'interleaved-thinking-2025-05-14',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error for ${agentName}: ${response.status} ${err}`);
  }

  let data = await response.json();

  // Agentic loop — keep going while the model wants to use tools
  let messages = [...body.messages];

  while (data.stop_reason === 'tool_use') {
    const assistantContent = data.content;

    // Collect all tool use blocks
    const toolUseBlocks = assistantContent.filter(b => b.type === 'tool_use');
    const toolResults   = [];

    for (const block of toolUseBlocks) {
      // web_search is handled server-side; the result comes back in the next turn
      // We just forward the tool_result back with the content Anthropic returned
      toolResults.push({
        type:        'tool_result',
        tool_use_id: block.id,
        content:     block.input?.query ? `Searching for: ${block.input.query}` : 'Search executed.',
      });
    }

    messages = [
      ...messages,
      { role: 'assistant', content: assistantContent },
      { role: 'user',      content: toolResults },
    ];

    response = await fetch(`${ANTHROPIC_BASE}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta':    'interleaved-thinking-2025-05-14',
      },
      body: JSON.stringify({ ...body, messages }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error (tool loop) for ${agentName}: ${response.status} ${err}`);
    }

    data = await response.json();
  }

  // Extract text from final response
  const textBlocks = data.content.filter(b => b.type === 'text');
  const result     = textBlocks.map(b => b.text).join('\n\n');

  console.log(`[${agentName}] Done. (${result.length} chars)`);
  return result;
}

// ─── System prompts ──────────────────────────────────────────────────────────

const SOURCING_SYSTEM = `You are an autonomous sourcing and competitive intelligence agent for a supplement startup.

The company is building a creatine monohydrate + magnesium glycinate capsule brand targeting women aged 30–45 in the wellness/longevity space (NOT bodybuilding). The brand differentiator is "made to order in small batches" — freshness as a premium signal.

Business model: "batch drop" pre-sell — only manufacture after 150 customers commit. Currently evaluating three contract manufacturers:
- Makers Nutrition (Commack NY) — lowest MOQ at 500–1,000 units, phone 1-844-625-3771
- NutraScience Labs (Farmingdale NY) — 1,500 bottle MOQ, best powder expertise, info@nutrasciencelabs.com
- Vitalpax (LaVerkin UT) — flexible pilot batches, Amazon FBA support, info@vitalpax.com

Your job: Use web search to research today's assigned topic thoroughly. Return a structured briefing with:
1. Key findings (bullet points, specific and actionable)
2. Data points with sources where possible
3. Recommended next actions for the founder
4. Any red flags or opportunities spotted

Be specific. Include real numbers, company names, URLs when found. This is for a founder making real business decisions today.`;

const SCIENTIST_SYSTEM = `You are an autonomous formulation scientist and regulatory intelligence agent for a supplement startup.

The company is developing a creatine monohydrate + magnesium glycinate capsule targeting women aged 30–45. Focus is on cognitive performance, energy, and longevity — NOT athletic/bodybuilding use. The brand story is "small batch, made to order" freshness.

Current formulation direction:
- Creatine monohydrate: likely 3–5g per serving
- Magnesium glycinate: likely 200–400mg elemental magnesium
- Capsule format (vegetarian/vegan preferred)
- No proprietary blends — full label transparency

Your job: Use web search to research today's assigned scientific topic thoroughly. Return a structured briefing with:
1. Key findings from recent research (2020–2025 preferred)
2. Specific data points, study citations where found
3. Formulation implications and recommendations
4. Anything that strengthens or challenges the current product direction
5. Regulatory considerations if relevant

Be precise. Reference actual studies, dosing numbers, and mechanisms. This is for a founder making product formulation decisions.`;

// ─── Email via Resend ─────────────────────────────────────────────────────────

async function sendEmail(subject, htmlBody) {
  if (!RESEND_API_KEY) {
    console.log('\n⚠️  RESEND_API_KEY not set — printing briefing to console instead.\n');
    console.log('═'.repeat(80));
    console.log(subject);
    console.log('═'.repeat(80));
    // Strip basic HTML for console readability
    console.log(
      htmlBody
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?[^>]+(>|$)/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
    );
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from:    FROM_EMAIL,
      to:      [TO_EMAIL],
      subject,
      html:    htmlBody,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  console.log(`\n✅ Email sent! Resend ID: ${data.id}`);
}

// ─── Format briefing as HTML email ───────────────────────────────────────────

function formatEmail(date, dayName, sourcingTopic, sourcingResult, scientistTopic, scientistResult) {
  const md2html = (text) =>
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^#{3}\s+(.+)$/gm, '<h3 style="color:#1a1a2e;margin:16px 0 8px;">$1</h3>')
      .replace(/^#{2}\s+(.+)$/gm, '<h2 style="color:#1a1a2e;margin:20px 0 10px;">$1</h2>')
      .replace(/^#{1}\s+(.+)$/gm, '<h1 style="color:#1a1a2e;margin:24px 0 12px;">$1</h1>')
      .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul style="margin:8px 0;padding-left:24px;">$&</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<[hul])(.+)$/gm, '$1')
      .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:680px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:32px 40px;">
      <p style="margin:0;color:#a0aec0;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">Daily Intelligence Briefing</p>
      <h1 style="margin:8px 0 4px;color:#ffffff;font-size:24px;font-weight:700;">Supplement Agents</h1>
      <p style="margin:0;color:#a0aec0;font-size:14px;">${dayName}, ${date}</p>
    </div>

    <!-- Sourcing Agent -->
    <div style="padding:32px 40px;border-bottom:1px solid #e8e8e8;">
      <div style="display:inline-block;background:#e8f4fd;color:#1a6fa8;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:4px 10px;border-radius:20px;margin-bottom:16px;">
        Sourcing Agent
      </div>
      <h2 style="margin:0 0 8px;color:#1a1a2e;font-size:18px;font-weight:700;">Today's Focus</h2>
      <p style="margin:0 0 20px;color:#4a5568;font-size:14px;font-style:italic;">${sourcingTopic}</p>
      <div style="color:#2d3748;font-size:15px;line-height:1.7;">
        <p>${md2html(sourcingResult)}</p>
      </div>
    </div>

    <!-- Scientist Agent -->
    <div style="padding:32px 40px;border-bottom:1px solid #e8e8e8;">
      <div style="display:inline-block;background:#f0fdf4;color:#1a7a4a;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:4px 10px;border-radius:20px;margin-bottom:16px;">
        Formulation Scientist
      </div>
      <h2 style="margin:0 0 8px;color:#1a1a2e;font-size:18px;font-weight:700;">Today's Focus</h2>
      <p style="margin:0 0 20px;color:#4a5568;font-size:14px;font-style:italic;">${scientistTopic}</p>
      <div style="color:#2d3748;font-size:15px;line-height:1.7;">
        <p>${md2html(scientistResult)}</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:24px 40px;background:#f8f9fa;">
      <p style="margin:0;color:#a0aec0;font-size:12px;text-align:center;">
        Generated by Supplement Agents · Ratio Wellness · <a href="mailto:ross@withratio.com" style="color:#a0aec0;">ross@withratio.com</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const now     = new Date();
  const dayIdx  = now.getDay(); // 0=Sun … 6=Sat
  const dayName = DAYS[dayIdx];
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const sourcingTopic   = SOURCING_TOPICS[dayIdx];
  const scientistTopic  = SCIENTIST_TOPICS[dayIdx];

  console.log(`\nSupplement Agents — ${dateStr}`);
  console.log(`Sourcing topic:   ${sourcingTopic.slice(0, 80)}...`);
  console.log(`Scientist topic:  ${scientistTopic.slice(0, 80)}...`);

  const sourcingPrompt  = `Today is ${dayName}, ${dateStr}.\n\nYour research topic for today:\n${sourcingTopic}\n\nResearch this thoroughly using web search and provide a detailed briefing.`;
  const scientistPrompt = `Today is ${dayName}, ${dateStr}.\n\nYour research topic for today:\n${scientistTopic}\n\nResearch this thoroughly using web search and provide a detailed briefing.`;

  // Run both agents in parallel
  const [sourcingResult, scientistResult] = await Promise.all([
    runAgent(SOURCING_SYSTEM,   sourcingPrompt,   'Sourcing Agent'),
    runAgent(SCIENTIST_SYSTEM,  scientistPrompt,  'Formulation Scientist'),
  ]);

  const subject  = `[${dayName}] Supplement Intelligence Briefing — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  const htmlBody = formatEmail(dateStr, dayName, sourcingTopic, sourcingResult, scientistTopic, scientistResult);

  await sendEmail(subject, htmlBody);
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err.message);
  process.exit(1);
});
