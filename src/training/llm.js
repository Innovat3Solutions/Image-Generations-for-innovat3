/**
 * Claude-powered engine for the Practice tab, implementing Innovat3's
 * training spec:
 *   - roleplayReply: play the prospect (with natural upsell openings)
 *   - gradeSession:  the 6-category 1-10 rubric + pace check, history-aware
 *   - generateScenarios: spin N scenarios from a new product/promo brief
 *   - demo* fallbacks: keyless canned versions so the tab is demoable
 *     before ANTHROPIC_API_KEY is configured
 *
 * Server-side refusal fallbacks (fallbacks: "default") are enabled.
 */
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';
const BETAS = ['server-side-fallback-2026-07-01'];

let _client = null;
function client() {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error('Practice mode needs an Anthropic API key — set ANTHROPIC_API_KEY in the environment.');
    err.code = 'NO_KEY';
    throw err;
  }
  if (!_client) _client = new Anthropic();
  return _client;
}

export function trainingAvailable() {
  return !!process.env.ANTHROPIC_API_KEY;
}

function textOf(response) {
  if (response.stop_reason === 'refusal') {
    throw new Error('The model declined this request — try rephrasing.');
  }
  const block = response.content.find((b) => b.type === 'text');
  return block ? block.text.trim() : '';
}

function materialsBlock(materials) {
  return materials.map((m) => `--- ${m.label.toUpperCase()} ---\n${m.content}`).join('\n\n');
}

function roleplaySystem(scenario, faqs, materials, options = {}) {
  const p = scenario.persona;
  const focus = options.focus_question ? `\nThe rep specifically wants to drill this objection today — make sure it comes up early and press on it: "${options.focus_question}"` : '';
  const gatekeeper = options.gatekeeper
    ? `\nSTART AT THE GATEKEEPER STAGE: you first answer as a receptionist/office manager screening the call ("What is this regarding?" / "They're busy right now"). Only put ${p.name} on the line if the rep handles you well. Once transferred, switch to playing ${p.name}.`
    : '';
  return `You are role-playing a sales-call PROSPECT so an Innovat3 sales rep can practice. Innovat3's PRIMARY offer is landing pages, with upsells in CRM setup, lead automation, and email marketing.

COMPANY MATERIALS (ground truth for this call):
${materialsBlock(materials)}

YOUR CHARACTER
Name: ${p.name}
Business: ${p.business} (${p.vertical})
Personality: ${p.personality}
Situation: ${p.situation}
${gatekeeper}
WHAT THE REP IS SELLING THIS CALL
${scenario.product_context}

OBJECTIONS YOU WILL RAISE (naturally, spread across the call — not all at once). Real prospects go off-script: you may also raise realistic objections that are NOT on this list.${focus}
${faqs.map((f) => `- "${f.question}"`).join('\n')}

UPSELL OPENINGS: when it fits naturally (never forced, not in every call), crack open a door to an upsell — e.g. "okay, but who's actually going to follow up with the leads this thing generates?", "I don't even have a CRM, is that a problem?", "I don't have anything set up for email". If the rep misses the opening, let the call continue naturally — the coach handles it in feedback, not you.

HOW TO PLAY IT
- Live phone call. Speak ONLY as your character — natural spoken language, 1-3 sentences per turn, contractions, occasional interruptions. Never narrate, never add stage directions, never break character, never mention being an AI, never coach mid-call.
- You did not ask for this call. Start neutral-to-guarded, consistent with your personality.
- Judge the rep's ACTUAL words, not whether they match a script. Effective phrasing in their own voice earns real movement; fluff and script-reading get pushback.
- Reward discovery: good questions about your business make you open up with useful details. Pitching without asking keeps you cold.
- Warm up to interest or agree to a concrete next step ONLY if genuinely earned. Never hand them the win.
- If pricing has NOT been provided in the materials, don't corner the rep into naming an exact number — press on value instead.
- Keep every reply under 60 words.`;
}

export async function roleplayReply(scenario, faqs, materials, transcript, options = {}) {
  const messages = transcript.map((t) => ({
    role: t.role === 'rep' ? 'user' : 'assistant',
    content: t.text,
  }));
  if (!messages.length) {
    messages.push({ role: 'user', content: '[The phone rings. Answer it the way this character (or their gatekeeper, if that option is set) would.]' });
  }
  const response = await client().beta.messages.create({
    model: MODEL,
    max_tokens: 1024,
    betas: BETAS,
    fallbacks: 'default',
    output_config: { effort: 'low' }, // fast turns — it's a live call
    system: roleplaySystem(scenario, faqs, materials, options),
    messages,
  });
  return textOf(response);
}

// ---- Grading: Innovat3's 6-category rubric ------------------------------

export const CATEGORIES = ['persuasion', 'confidence', 'product_knowledge', 'quickness', 'upsell_recognition', 'closing'];

const GRADE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['overall', 'categories', 'outcome', 'faq_results', 'what_worked', 'what_to_fix', 'alternative_line', 'pace_check', 'rebuttals', 'new_objections', 'progress_note', 'summary'],
  properties: {
    overall: { type: 'integer', description: 'Overall score 1-10 — holistic judgment, NOT an average' },
    outcome: { type: 'string', enum: ['closed', 'appointment_set', 'warm_interest', 'objection_unresolved', 'did_not_engage', 'lost'] },
    categories: {
      type: 'object',
      additionalProperties: false,
      required: CATEGORIES,
      properties: {
        persuasion: { type: 'integer', description: '1-10: did the pitch actually move the prospect toward yes' },
        confidence: { type: 'integer', description: '1-10: tone, pacing, no hedging or backing down under pushback' },
        product_knowledge: { type: 'integer', description: '1-10: accurate on inclusions/pricing/timelines; no promises outside the approved materials' },
        quickness: { type: 'integer', description: '1-10: fast smooth objection handling, no fumbling' },
        upsell_recognition: { type: 'integer', description: '1-10: noticed and acted on upsell openings (CRM / follow-up / email) the prospect gave' },
        closing: { type: 'integer', description: '1-10: asked directly for the sale or a concrete next step' },
      },
    },
    faq_results: {
      type: 'array',
      description: 'One entry per objection the prospect raised (listed or off-script)',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'handled', 'feedback'],
        properties: {
          question: { type: 'string' },
          handled: { type: 'string', enum: ['strong', 'partial', 'missed'] },
          feedback: { type: 'string' },
        },
      },
    },
    what_worked: { type: 'array', items: { type: 'string' }, description: '2-3 specific moments, QUOTING the call' },
    what_to_fix: { type: 'string', description: 'The single biggest thing holding this call back — plain, not softened' },
    alternative_line: { type: 'string', description: 'One specific rephrase for the weakest moment, in the rep\'s own voice' },
    pace_check: { type: 'string', description: 'One direct line connecting this call to the 4-closes/week goal' },
    rebuttals: {
      type: 'array',
      description: 'For each objection handled partial/missed: a model answer to steal',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'say_this'],
        properties: { question: { type: 'string' }, say_this: { type: 'string' } },
      },
    },
    new_objections: {
      type: 'array',
      description: 'Objections the prospect raised that are NOT in the provided library — so the library can grow',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'rebuttal_points'],
        properties: {
          question: { type: 'string', description: 'The objection, phrased as the prospect asks it' },
          rebuttal_points: { type: 'array', items: { type: 'string' }, description: '2-3 points a strong answer should hit' },
        },
      },
    },
    progress_note: { type: 'string', description: "One sentence on this rep's trajectory vs their recent calls (improving/flat/slipping and where). Empty string if no history." },
    summary: { type: 'string', description: "2-3 sentence coach's verdict" },
  },
};

/**
 * Grade a call. transcript may come from a roleplay session or a pasted
 * real call. history = this rep's recent completed grades (for trajectory).
 */
export async function gradeSession({ scenarioDescription, faqs, materials, transcript, repName, history = [], isRealCall = false }) {
  const convo = typeof transcript === 'string'
    ? transcript
    : transcript.map((t) => `${t.role === 'rep' ? 'REP' : 'PROSPECT'}: ${t.text}`).join('\n');
  const rubric = faqs.map((f) =>
    `- "${f.question}" — a strong answer hits: ${JSON.parse(f.rebuttal_points_json || '[]').join('; ')}`
  ).join('\n');
  const historyBlock = history.length
    ? `\n${repName.toUpperCase()}'S RECENT CALLS (oldest→newest) — use for the progress_note and to call out recurring weaknesses:\n${history.map((h) => `- ${h.date}: overall ${h.overall}/10, weakest: ${h.weakest}, fix given: ${h.what_to_fix}`).join('\n')}`
    : '';

  const response = await client().beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: BETAS,
    fallbacks: 'default',
    output_config: {
      effort: 'high',
      format: { type: 'json_schema', schema: GRADE_SCHEMA },
    },
    system: `You are Innovat3's sales coach. Innovat3's PRIMARY offer is landing pages, with upsells in CRM setup, lead automation, and email marketing. Be direct and specific — quote the transcript, never pad feedback with unearned praise. The goal is reps who close more, not reps who feel good about a mediocre call. Score honestly: a mediocre call is 4-6; reserve 9-10 for calls that would genuinely close. Judge the rep's own voice and effectiveness, not adherence to a script.

COMPANY MATERIALS (ground truth — flag any promise outside these as a Product Knowledge problem):
${materialsBlock(materials)}`,
    messages: [{
      role: 'user',
      content: `${isRealCall ? 'This is a REAL call the rep already had (identify what stage it reached and where it lost momentum, and quote any upsell opening that was missed or used well).' : 'This is a practice roleplay call.'}

REP: ${repName}
SCENARIO: ${scenarioDescription}

OBJECTION RUBRIC (what strong answers include):
${rubric || '(library rubric not applicable — judge on the materials above)'}
${historyBlock}

TRANSCRIPT:
${convo}

Grade this call.`,
    }],
  });
  if (response.stop_reason === 'refusal') throw new Error('Grading was declined — try again.');
  const block = response.content.find((b) => b.type === 'text');
  return JSON.parse(block.text);
}

// ---- Scenario generation ------------------------------------------------

const SCENARIOS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['scenarios'],
  properties: {
    scenarios: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'persona', 'product_context', 'faq_questions', 'difficulty'],
        properties: {
          title: { type: 'string' },
          persona: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'business', 'vertical', 'personality', 'situation'],
            properties: {
              name: { type: 'string' },
              business: { type: 'string' },
              vertical: { type: 'string' },
              personality: { type: 'string' },
              situation: { type: 'string' },
            },
          },
          product_context: { type: 'string' },
          faq_questions: { type: 'array', items: { type: 'string' } },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
        },
      },
    },
  },
};

export async function generateScenarios(brief, faqQuestions, count = 10) {
  const response = await client().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: BETAS,
    fallbacks: 'default',
    output_config: {
      effort: 'high',
      format: { type: 'json_schema', schema: SCENARIOS_SCHEMA },
    },
    system: 'You design sales-training scenarios for Innovat3, whose primary offer is landing pages with upsells in CRM setup, lead automation, and email marketing, sold to small businesses (restaurants, clinics, repair shops, salons, professional services, trades...). Personas must feel like real small-business owners with distinct personalities and realistic situations — never cartoons.',
    messages: [{
      role: 'user',
      content: `NEW PRODUCT / PROMO BRIEF:
${brief}

AVAILABLE OBJECTIONS (use these verbatim in faq_questions, 2-3 per scenario, varied across scenarios):
${faqQuestions.map((q) => `- "${q}"`).join('\n')}

Create ${count} distinct practice scenarios for this brief: vary the verticals, personalities, difficulties, and which objections come up, so a rep who runs all of them has faced this product from every angle.`,
    }],
  });
  if (response.stop_reason === 'refusal') throw new Error('Generation was declined — try rephrasing the brief.');
  const block = response.content.find((b) => b.type === 'text');
  return JSON.parse(block.text).scenarios;
}

// ---- Demo fallbacks (no API key yet) ------------------------------------
// Canned but scenario-aware, so the team can click through the whole flow
// today; the moment ANTHROPIC_API_KEY lands, the real engine takes over.

export function demoReply(scenario, faqs, transcript) {
  const p = scenario.persona;
  const first = p.name.split(' ')[0];
  const repTurns = transcript.filter((t) => t.role === 'rep').length;
  if (repTurns === 0) return `${first} here, ${p.business}. Kind of in the middle of something — what's this about?`;
  const idx = repTurns - 1;
  if (idx < faqs.length) return `Hm. ${faqs[idx].question}`;
  if (idx === faqs.length) return `Okay, but who's actually going to follow up with the leads this thing generates? I don't have a CRM or anything.`;
  return `Alright, you've got my attention. What would the next step even look like?`;
}

export function demoGrade(repName) {
  return {
    demo: true,
    overall: 6,
    outcome: 'warm_interest',
    categories: { persuasion: 6, confidence: 7, product_knowledge: 5, quickness: 6, upsell_recognition: 4, closing: 6 },
    faq_results: [
      { question: 'How much does this cost?', handled: 'partial', feedback: 'SAMPLE: quoted value but never anchored it to their job size.' },
      { question: 'Who follows up with the leads?', handled: 'missed', feedback: 'SAMPLE: this was a lead-automation upsell opening — it went by unclaimed.' },
    ],
    what_worked: ['SAMPLE: opened with a question about their business instead of a pitch.', 'SAMPLE: stayed calm when pushed on price.'],
    what_to_fix: 'SAMPLE GRADE — this is canned demo output. Add ANTHROPIC_API_KEY and the coach will grade your actual words this specifically.',
    alternative_line: 'SAMPLE: "Before I talk numbers — when someone fills out your form today, what happens in the first five minutes?"',
    pace_check: `SAMPLE: at this conversion feel, ${repName} lands ~2 closes/week — under the 4/week goal.`,
    rebuttals: [{ question: 'Who follows up with the leads?', say_this: 'SAMPLE: "Great question — that\'s exactly what our lead automation handles: instant text-back, then a follow-up sequence until they book."' }],
    new_objections: [],
    progress_note: '',
    summary: 'DEMO MODE — this is a sample scorecard so you can see the flow. Connect the Anthropic API key and every score, quote, and fix will come from your real call.',
  };
}
