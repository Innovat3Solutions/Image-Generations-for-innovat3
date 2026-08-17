/**
 * AI site extraction — the ScrapeGraphAI pattern, integrated natively.
 *
 * ScrapeGraphAI's SmartScraperGraph pipeline is fetch → parse-to-text →
 * "LLM + schema" extraction: you declare WHAT you want and the model reads
 * the page like a human, instead of regex/CSS selectors that miss anything
 * unusual (obfuscated emails, people named only in prose, services listed
 * in images' alt text, etc.).
 *
 * The library itself is Python ≥3.12 + Playwright — a second runtime we
 * don't want on a 512MB Node dyno — so this module implements the same
 * graph natively with two interchangeable engines:
 *
 *   1. hosted  — ScrapeGraphAI's cloud API (SCRAPEGRAPHAI_API_KEY): their
 *      infra fetches the page (JS rendering, anti-bot, proxies) AND runs
 *      the extraction. Best for sites our plain fetch can't read.
 *   2. local   — our own fetch (already done by website discovery) → text
 *      → Claude structured output (ANTHROPIC_API_KEY). No extra services.
 *
 * Trust boundary: extracted EMAILS are candidates only — they pass through
 * the same verification gate as every other source (strict no-guessed-email
 * policy). Phones are normalized; people fill gaps, never overwrite.
 */
import * as cheerio from 'cheerio';
import Anthropic from '@anthropic-ai/sdk';
import { config, providers } from '../config.js';
import { fetchWithTimeout, normalizePhone, log } from '../util.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';
let _client = null;
const client = () => (_client ||= new Anthropic());

export const aiExtractAvailable = () =>
  (config.enrichment.ai?.enabled ?? true) && !!(providers.scrapegraph || process.env.ANTHROPIC_API_KEY);

// What we ask for — the "prompt + schema" both engines share
const EXTRACT_PROMPT = `Extract contact and business facts for THIS business from its website text. Only include what the text actually supports — never guess or invent. Emails may be obfuscated ("info (at) domain (dot) com" → info@domain.com). People must be actual humans at this business (owner, founder, manager, doctor…), not testimonial authors or vendors.`;

const EXTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['emails', 'phones', 'people', 'services', 'service_area', 'signals'],
  properties: {
    emails: { type: 'array', items: { type: 'string' }, description: 'Email addresses shown on the site (de-obfuscated), most business-relevant first' },
    phones: { type: 'array', items: { type: 'string' }, description: 'Phone numbers shown on the site' },
    people: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['name', 'title'],
        properties: { name: { type: 'string' }, title: { type: 'string', description: 'Their role, e.g. Owner, Office Manager' } },
      },
    },
    services: { type: 'array', items: { type: 'string' }, description: 'Main services/offerings, ≤8 short labels' },
    service_area: { type: ['string', 'null'], description: 'Cities/counties they say they serve, or null' },
    signals: {
      type: 'object', additionalProperties: false,
      required: ['online_booking', 'live_chat', 'financing', 'emergency_service'],
      properties: {
        online_booking: { type: 'boolean' },
        live_chat: { type: 'boolean' },
        financing: { type: 'boolean' },
        emergency_service: { type: 'boolean' },
      },
    },
  },
};

/** ParseNode equivalent: HTML → clean readable text. */
export function htmlToText(html, cap = 14000) {
  const $ = cheerio.load(html);
  $('script, style, noscript, svg, iframe').remove();
  // alt text often names services that appear nowhere else
  $('img[alt]').each((_, el) => { $(el).replaceWith(` ${$(el).attr('alt')} `); });
  return $('body').text().replace(/\s+/g, ' ').trim().slice(0, cap);
}

/** Links worth a second fetch: contact / about / team pages on the same host. */
export function findSubPages(html, baseUrl, max = 2) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const out = [];
  const base = new URL(baseUrl);
  $('a[href]').each((_, el) => {
    if (out.length >= max) return;
    try {
      const url = new URL($(el).attr('href'), base);
      if (url.hostname.replace(/^www\./, '') !== base.hostname.replace(/^www\./, '')) return;
      if (!/contact|about|team|staff|meet|our-story/i.test(url.pathname)) return;
      const key = url.pathname.replace(/\/$/, '');
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(url.href);
    } catch { /* bad href */ }
  });
  return out;
}

/**
 * Engine 1 — ScrapeGraphAI hosted API (v2 Extract): their infra fetches +
 * renders the page AND runs the schema extraction. 5 credits per call.
 * https://docs.scrapegraphai.com/services/extract
 */
async function hostedExtract(websiteUrl) {
  const res = await fetchWithTimeout('https://v2-api.scrapegraphai.com/api/extract', {
    method: 'POST',
    timeout: 90000,
    headers: { 'SGAI-APIKEY': providers.scrapegraph, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: websiteUrl,
      prompt: EXTRACT_PROMPT,
      schema: EXTRACT_SCHEMA,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`scrapegraphai ${res.status}${body?.error?.message ? ` — ${body.error.message}` : ''}`);
  }
  const data = await res.json();
  return data.json || data.result || data;
}

/** Engine 2 — local: our page text + Claude structured output. */
async function localExtract(pagesText, businessName) {
  const response = await client().beta.messages.create({
    model: MODEL,
    max_tokens: 1200,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: EXTRACT_SCHEMA },
    },
    system: EXTRACT_PROMPT,
    messages: [{
      role: 'user',
      content: `BUSINESS: ${businessName}\n\nWEBSITE TEXT (one or more pages):\n${pagesText}`,
    }],
  });
  if (response.stop_reason === 'refusal') return null;
  const block = response.content.find((b) => b.type === 'text');
  return JSON.parse(block.text);
}

/**
 * Run AI extraction over a prospect's site. `homepageHtml` is the page
 * website discovery already fetched (no duplicate request); the local
 * engine additionally reads up to `maxPages-1` contact/about subpages.
 * Returns { emails, phones, people, facts } — normalized, or null.
 */
export async function aiSiteExtract(prospect, homepageHtml) {
  if (!aiExtractAvailable() || !prospect.website) return null;
  try {
    let raw;
    if (providers.scrapegraph) {
      raw = await hostedExtract(prospect.website);
    } else {
      if (!homepageHtml) return null;
      const maxPages = config.enrichment.ai?.maxPages ?? 3;
      const texts = [`[HOMEPAGE]\n${htmlToText(homepageHtml)}`];
      for (const url of findSubPages(homepageHtml, prospect.website, maxPages - 1)) {
        try {
          const res = await fetchWithTimeout(url, { timeout: 15000 });
          if (res.ok) texts.push(`[${url}]\n${htmlToText(await res.text(), 6000)}`);
        } catch { /* subpage unreachable — homepage still counts */ }
      }
      raw = await localExtract(texts.join('\n\n'), prospect.business_name);
    }
    if (!raw) return null;

    const phones = [...new Set((raw.phones || []).map(normalizePhone).filter(Boolean))];
    const emails = [...new Set((raw.emails || [])
      .map((e) => String(e).trim().toLowerCase())
      .filter((e) => /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e)))];
    const people = (raw.people || []).filter((p) => p?.name && /\s/.test(p.name.trim())).slice(0, 5);
    const result = {
      emails,
      phones,
      people,
      facts: {
        services: (raw.services || []).slice(0, 8),
        serviceArea: raw.service_area || null,
        ...raw.signals,
      },
    };
    log(`ai-extract [${providers.scrapegraph ? 'scrapegraphai' : 'claude'}] ${prospect.business_name}: ${emails.length} emails, ${phones.length} phones, ${people.length} people`);
    return result;
  } catch (err) {
    log(`ai-extract skipped for ${prospect.business_name} — ${err.message}`);
    return null;
  }
}
