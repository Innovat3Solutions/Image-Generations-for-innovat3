/**
 * Claude-powered engine for the Practice tab:
 *   - roleplayReply: play the prospect in a simulated sales call
 *   - gradeSession:  score the call + coaching feedback (structured output)
 *   - generateScenarios: spin N scenarios from a new product/promo brief
 *
 * Needs ANTHROPIC_API_KEY. Server-side refusal fallbacks are enabled by
 * default (fallbacks: "default") so a rare classifier decline transparently
 * re-runs on Anthropic's recommended fallback model.
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

function roleplaySystem(scenario, faqs) {
  const p = scenario.persona;
  return `You are role-playing a sales-call PROSPECT so an Innovat3 sales rep can practice. Innovat3 sells websites, AI receptionists/missed-call capture, booking systems, CRM and automation to small businesses.

YOUR CHARACTER
Name: ${p.name}
Business: ${p.business} (${p.vertical})
Personality: ${p.personality}
Situation: ${p.situation}

WHAT THE REP IS SELLING THIS CALL
${scenario.product_context}

OBJECTIONS YOU WILL RAISE (naturally, spread across the call — not all at once):
${faqs.map((f) => `- "${f.question}"`).join('\n')}

HOW TO PLAY IT
- This is a live phone call. Speak ONLY as ${p.name} — natural spoken language, 1-3 sentences per turn, contractions, occasional interruptions. Never narrate, never add stage directions, never break character, never mention being an AI.
- You did not ask for this call. Start neutral-to-guarded, consistent with your personality.
- Raise your listed objections at natural moments. If the rep handles one well (concrete, relevant to YOUR business, addresses the real concern), soften on that point. If they answer with fluff, push back harder.
- Reward discovery: if the rep asks good questions about your business, open up with useful details. If they pitch without asking anything, stay cold.
- You can warm up to interest ("okay, what would that look like for me?") or agree to a concrete next step ONLY if the rep genuinely earns it. Never hand them the win for free.
- If the rep is rude, reads a script at you, or wastes your time, you may wrap up the call like a real busy owner would.
- Keep every reply under 60 words.`;
}

/**
 * Next prospect line. transcript = [{role:'rep'|'prospect', text}]
 * Empty transcript → the prospect answers the phone.
 */
export async function roleplayReply(scenario, faqs, transcript) {
  const messages = transcript.map((t) => ({
    role: t.role === 'rep' ? 'user' : 'assistant',
    content: t.text,
  }));
  if (!messages.length) {
    messages.push({ role: 'user', content: '[The phone rings. Answer it the way this character would.]' });
  }
  const response = await client().beta.messages.create({
    model: MODEL,
    max_tokens: 1024,
    betas: BETAS,
    fallbacks: 'default',
    output_config: { effort: 'low' }, // fast turns — it's a live call
    system: roleplaySystem(scenario, faqs),
    messages,
  });
  return textOf(response);
}

const GRADE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['overall', 'buckets', 'faq_results', 'strengths', 'focus_areas', 'rebuttals', 'summary', 'outcome'],
  properties: {
    overall: { type: 'integer', description: 'Overall call score 0-100' },
    outcome: { type: 'string', enum: ['booked_next_step', 'warm_interest', 'neutral', 'lost'], description: 'How the call actually ended' },
    buckets: {
      type: 'object',
      additionalProperties: false,
      required: ['discovery', 'objection_handling', 'value_communication', 'rapport', 'closing'],
      properties: {
        discovery: { type: 'integer', description: '0-20: asked about their business before pitching' },
        objection_handling: { type: 'integer', description: '0-25: addressed the real concern with substance' },
        value_communication: { type: 'integer', description: '0-25: tied Innovat3 to THEIR numbers/outcomes, not features' },
        rapport: { type: 'integer', description: '0-15: tone, listening, matching the persona' },
        closing: { type: 'integer', description: '0-15: asked for a concrete next step' },
      },
    },
    faq_results: {
      type: 'array',
      description: 'One entry per objection the prospect raised',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'handled', 'feedback'],
        properties: {
          question: { type: 'string' },
          handled: { type: 'string', enum: ['strong', 'partial', 'missed'] },
          feedback: { type: 'string', description: 'One sentence on what they did / should have done' },
        },
      },
    },
    strengths: { type: 'array', items: { type: 'string' }, description: '2-3 specific things the rep did well, quoting the call' },
    focus_areas: { type: 'array', items: { type: 'string' }, description: '2-3 specific things to work on, most important first' },
    rebuttals: {
      type: 'array',
      description: 'For each objection handled partial/missed: a model answer the rep can steal',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'say_this'],
        properties: {
          question: { type: 'string' },
          say_this: { type: 'string', description: 'A 2-3 sentence spoken answer in a natural rep voice' },
        },
      },
    },
    summary: { type: 'string', description: '2-3 sentence coach\'s verdict on the call' },
  },
};

export async function gradeSession(scenario, faqs, transcript) {
  const convo = transcript.map((t) => `${t.role === 'rep' ? 'REP' : 'PROSPECT'}: ${t.text}`).join('\n');
  const rubric = faqs.map((f) =>
    `- "${f.question}" — a strong answer hits: ${JSON.parse(f.rebuttal_points_json || '[]').join('; ')}`
  ).join('\n');

  const response = await client().beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: BETAS,
    fallbacks: 'default',
    output_config: {
      effort: 'high',
      format: { type: 'json_schema', schema: GRADE_SCHEMA },
    },
    system: `You are Innovat3's sales coach grading a practice call. Innovat3 sells websites, AI receptionists, booking systems, CRM and automation to small businesses. Be a demanding but fair coach: specific, quoting the transcript, never generic. Score honestly — a mediocre call scores 40-60; reserve 85+ for calls that would genuinely win the prospect. Bucket scores must sum to the overall score.`,
    messages: [{
      role: 'user',
      content: `SCENARIO: The rep called ${scenario.persona.name} of ${scenario.persona.business} (${scenario.persona.vertical}). ${scenario.persona.situation}

WHAT THE REP WAS SELLING: ${scenario.product_context}

OBJECTION RUBRIC (what strong answers include):
${rubric}

TRANSCRIPT:
${convo}

Grade this call.`,
    }],
  });
  if (response.stop_reason === 'refusal') throw new Error('Grading was declined — try again.');
  const block = response.content.find((b) => b.type === 'text');
  return JSON.parse(block.text);
}

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
          product_context: { type: 'string', description: 'What the rep is selling in this scenario, incl. the new product/promo' },
          faq_questions: { type: 'array', items: { type: 'string' }, description: '2-3 objections from the provided FAQ list, verbatim' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
        },
      },
    },
  },
};

/** Generate N practice scenarios for a new product/promo brief. */
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
    system: 'You design sales-training scenarios for Innovat3, which sells websites, AI receptionists, booking systems, CRM and automation to small businesses (roofers, HVAC, plumbers, law firms, med spas, dentists, restaurants...). Personas must feel like real small-business owners with distinct personalities and realistic situations — never cartoons.',
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
