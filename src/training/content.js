/**
 * Seed training content: the frequently-asked questions / objections
 * Innovat3 reps hear, each with the rebuttal points a strong answer hits,
 * plus the starting scenario roster. Managers can add more from the UI —
 * these just make the Practice tab useful on day one.
 */
import { db } from '../db.js';

export const SEED_FAQS = [
  {
    question: 'How much does this cost?',
    category: 'price',
    rebuttal_points: [
      'Never quote a naked number — anchor price to what a missed lead costs them first',
      'Ask about their average job/customer value to frame ROI in their numbers',
      'Present a range with a clear "what you get", then offer to scope it precisely',
    ],
  },
  {
    question: "Why is it so cheap? What's the catch?",
    category: 'price',
    rebuttal_points: [
      'AI and automation cut OUR delivery cost — we pass that on; the work is not cheaper, the tooling is',
      'We win by keeping clients monthly, not by charging big up front — retention model',
      'Offer proof: portfolio, live client examples, guarantee terms',
    ],
  },
  {
    question: 'Why is it so expensive? I can get a website for $200.',
    category: 'price',
    rebuttal_points: [
      "A $200 site is a brochure; you're buying a lead system: site + booking + follow-up + missed-call capture",
      'One extra job a month typically pays for everything — tie to their job value',
      "Cheap sites cost more later: no mobile, no SEO, no conversion — that's why their phone isn't ringing",
    ],
  },
  {
    question: 'How do you actually do this? How does it work?',
    category: 'process',
    rebuttal_points: [
      'Explain the simple 3-step: build the foundation (site/booking), connect the automation (missed-call text-back, follow-ups), then optimize monthly',
      'No tech work on their side — we set up everything, they keep doing jobs',
      'Concrete example: a call comes in while they are on a roof — what happens next with vs. without us',
    ],
  },
  {
    question: 'I already have a guy who does my website.',
    category: 'competition',
    rebuttal_points: [
      "Not a replacement pitch — ask what happens to leads AFTER the site: follow-up, booking, missed calls",
      'Offer the free audit: we show what the current setup is leaking before asking for anything',
      'Position on outcomes: keep the guy, we handle the automation layer',
    ],
  },
  {
    question: "AI sounds complicated. I'm not a tech person.",
    category: 'trust',
    rebuttal_points: [
      "They never touch the AI — it just answers calls/texts like a receptionist that never sleeps",
      'Everything is set up for them; day-to-day nothing changes except fewer missed leads',
      'Offer to demo it live on their own phone in 2 minutes',
    ],
  },
  {
    question: "I don't have time for this right now.",
    category: 'timing',
    rebuttal_points: [
      'Agree — that IS the problem we fix; being too busy to answer calls is losing them money',
      'Total time ask: one 20-minute onboarding call, we do the rest',
      'Book a specific short slot now instead of "later" — later never comes',
    ],
  },
  {
    question: 'Just send me an email / call me back later.',
    category: 'timing',
    rebuttal_points: [
      'Take it as buying-temperature signal, not rejection — ask one qualifying question before agreeing',
      'Agree to send it AND lock a concrete follow-up time on the calendar in the same breath',
      'Make the email worth opening: promise the audit result or a specific number, not a brochure',
    ],
  },
  {
    question: 'We just opened. It feels too early for this.',
    category: 'timing',
    rebuttal_points: [
      'Early is the advantage: infrastructure decisions are being made right now — cheaper to build right than rebuild',
      'First customers come from being findable — no site/booking means losing them to competitors from day one',
      'Start small: foundation package now, automation as they grow',
    ],
  },
  {
    question: 'Does this actually work? Prove it.',
    category: 'trust',
    rebuttal_points: [
      'Concrete numbers from comparable clients (missed-call recovery rate, booking lift), not adjectives',
      'Name the mechanism, not magic: faster response wins the job — most customers hire whoever answers first',
      'Reduce risk: pilot period, month-to-month, or a specific guarantee',
    ],
  },
];

export const SEED_SCENARIOS = [
  {
    title: 'The Skeptical Roofer',
    persona: {
      name: 'Mike Delgado',
      business: 'Delgado Roofing LLC',
      vertical: 'Roofing',
      personality: 'Gruff, busy, has been burned by two marketing agencies before. Answers on a job site with crew noise. Respects straight talk, hates buzzwords.',
      situation: 'Licensed 2 months ago after 15 years working for someone else. No website, gets work from referrals. Misses calls constantly while on roofs.',
    },
    product_context: 'Innovat3 core offer: website + online booking + AI receptionist / missed-call text-back + review automation.',
    faq_questions: ['How much does this cost?', 'Does this actually work? Prove it.', "I don't have time for this right now."],
    difficulty: 'hard',
  },
  {
    title: 'The Busy Med Spa Owner',
    persona: {
      name: 'Dr. Elena Vasquez',
      business: 'Radiance Aesthetics',
      vertical: 'Med Spa',
      personality: 'Polished, time-poor, detail-oriented. Between patients. Warm but will cut the call short the moment it rambles.',
      situation: 'Opened 3 months ago. Has a decent Instagram but a weak website with no online booking. Front desk misses calls during treatments.',
    },
    product_context: 'Innovat3 offer focused on booking automation + AI receptionist + lead follow-up for high-value appointments.',
    faq_questions: ['I already have a guy who does my website.', 'Just send me an email / call me back later.', 'How do you actually do this? How does it work?'],
    difficulty: 'medium',
  },
  {
    title: 'The Brand-New Restaurant Owner',
    persona: {
      name: 'Tony Ferraro',
      business: "Ferraro's Kitchen",
      vertical: 'Restaurant',
      personality: 'Friendly, excitable, but every dollar is spoken for. Compares every price to food cost. Talks fast.',
      situation: 'Opened 6 weeks ago. Facebook page only. Thinks a website is a luxury; a nephew "can do it cheap".',
    },
    product_context: 'Starter digital foundation: website + Google Business + reservations/ordering links + review automation.',
    faq_questions: ['Why is it so expensive? I can get a website for $200.', 'We just opened. It feels too early for this.'],
    difficulty: 'medium',
  },
  {
    title: 'The Cautious Law Firm Partner',
    persona: {
      name: 'Patricia Okafor',
      business: 'Okafor & Associates',
      vertical: 'Law Firm',
      personality: 'Measured, asks precise questions, allergic to hype. Evaluates everything for risk. Polite but probing.',
      situation: 'Two-partner firm, 4 months old. Basic website exists. Intake is a shared inbox nobody owns; leads go cold over weekends.',
    },
    product_context: 'Intake automation + AI receptionist for after-hours + CRM with follow-up sequences, positioned for confidentiality-conscious buyers.',
    faq_questions: ['How do you actually do this? How does it work?', "AI sounds complicated. I'm not a tech person.", 'Why is it so cheap? What\'s the catch?'],
    difficulty: 'hard',
  },
  {
    title: 'The Overwhelmed HVAC Owner',
    persona: {
      name: 'Sam Brooks',
      business: 'Brooks Air & Heat',
      vertical: 'HVAC',
      personality: 'Nice, apologetic, chronically overwhelmed. Agrees with everything then does nothing. Needs help committing.',
      situation: 'Just hired a second tech. Phone rings constantly in season; half the calls go to voicemail. No booking, no follow-up.',
    },
    product_context: 'Missed-call text-back + scheduling + estimate follow-up automation.',
    faq_questions: ["I don't have time for this right now.", 'Just send me an email / call me back later.', 'How much does this cost?'],
    difficulty: 'easy',
  },
];

/**
 * Company materials injected into every roleplay and grading prompt —
 * from Innovat3's training spec. Placeholders are editable from the
 * Practice tab; the coach treats missing sections conservatively (e.g.
 * never quotes concrete prices that haven't been provided).
 */
// From the INNOVAT3 Company Pricing Standard v1.1 (Aug 2026)
export const SEED_MATERIALS = [
  {
    key: 'offer',
    label: 'The Sales Ladder (primary offer & upsells)',
    content: `Sell outcomes in sequence, never a menu: Presence → Reputation → Communication → Automation → Growth → Outsourced Marketing.
THE $99 LAUNCH PLAN IS THE STANDARD FOOT-IN-THE-DOOR: make the first yes easy, create the relationship, upgrade on measured need.
Ladder: LAUNCH $99 (landing page + review access) → LOCAL $199 (review automation + Google optimization) → CONNECT $399 (CRM + pipeline + missed-call text back + follow-up) → AI $699+usage (24/7 AI receptionist) → GROWTH $999+usage (reactivation + email + retargeting) → MARKETING TEAM $1,675 (12 content pieces + email marketing) → MARKETING GROWTH $1,995 (20 pieces) → MARKETING PRO $2,495 (30 pieces).
Rule: lead with the LOWEST package that solves the immediate problem. Explain only the recommended package and at most the next upgrade.`,
  },
  {
    key: 'pricing',
    label: 'Pricing (monthly / setup)',
    content: `LAUNCH $99/mo + $199 setup — landing page, review link/QR, hosting, lead form.
LOCAL $199/mo + $399 setup — + automated review requests, Google Business audit/optimization.
CONNECT $399/mo + $750 setup — + CRM, 1 pipeline, 1 calendar, missed-call text back, follow-up, 3 workflows, 2 nurture sequences.
AI $699/mo + usage + $1,250 setup — + AI voice receptionist, qualification, booking, after-hours, quarterly reactivation.
GROWTH $999/mo + usage + $1,950 setup — + monthly reactivation, email marketing, retargeting pixels/audiences, 10 workflows, reporting.
MARKETING TEAM $1,675/mo + $3,150 setup — 12 content pieces/mo, multi-platform, email marketing included, client supplies raw media.
MARKETING GROWTH $1,995/mo + $3,150 — 20 pieces/mo. MARKETING PRO $2,495/mo + $3,150 — 30 pieces/mo, near-daily.
KEY ADD-ONS: AI Voice $299-399/mo+usage · Missed-Call Text Back $49/mo · Review Automation $79/mo · GBP Management $149-249/mo · Email Marketing $199-399/mo · Reactivation $299/campaign or $199/mo · Extra landing page $99/mo or $299 build.
ONE-TIME: 5-page site from $1,500 · premium site from $2,500 · e-commerce from $3,500 · CRM migration from $750 · funnel $750-1,500+.
BUNDLING RULE: if package + add-ons ≥ next package, sell the upgrade (Connect $399 + AI Voice $399 = $798 → sell AI $699).
Ad spend and usage (AI minutes, SMS, telephony) are ALWAYS billed separately.`,
  },
  {
    key: 'call_script',
    label: 'Qualification playbook & talk tracks',
    content: `DIAGNOSE BEFORE QUOTING — never open by reading features. Key questions:
- Presence: "Do you have a simple page that tells people what you do and how to contact you?"
- Reviews: "How are you currently asking customers for Google reviews?"
- Capture: "Where do new leads go when someone fills out a form, calls or messages you?"
- Follow-up: "What happens if your team misses a call or doesn't reach a lead the first time?"
- Phones: "Who answers after hours, during lunch, or when the team is busy?"
- Database: "How many past leads are sitting in your database without follow-up?"
- Marketing: "Who currently plans, creates, schedules and publishes your marketing?"
FAST DIAGNOSIS: "just need a page + review link"→Launch · "need reviews/Google help"→Local · "leads falling through cracks"→Connect · "miss calls / need 24-7"→AI · "old leads, want campaigns"→Growth · "run our marketing"→Marketing Team.
TALK TRACKS: Launch: "We start by giving you a clean conversion page and an easy way for customers to leave Google reviews." Local: "Local adds the system that actively asks for reviews and improves how you show up on Google." Connect: "CRM, pipeline and automatic follow-up so leads stop getting lost." AI: "A 24/7 receptionist that answers, qualifies, routes and books." Growth: "Campaigns, reactivation, email and retargeting — creating more opportunities, not just capturing them." Marketing Team: "You're hiring our marketing team: 12 finished pieces plus email marketing; you supply the raw photos/video."`,
  },
  {
    key: 'service_limits',
    label: "What we can and can't promise",
    content: `NEVER promise: unlimited revisions/content/automations/AI usage/locations; SEO unless contracted; on-site videography or photography (client supplies raw media — we edit/design/publish); ad spend included; custom software or API work inside a package (that's Custom Solutions, scoped separately).
ALWAYS disclose: usage costs (AI voice minutes, SMS, telephony, premium email volume) and ad spend are billed separately or against the proposal allowance.
Marketing revision standard: 1 reasonable revision round per asset; direction changes after approval are quoted separately.
Marketing content: 1 piece = 1 original concept; cross-posting one Reel to IG+FB+TikTok is still 1 piece.
If the client doesn't supply requested media, we continue with graphics/copy/reviews where possible — the fee does not reduce.`,
  },
  {
    key: 'team_goal',
    label: 'Weekly team goal',
    content: `Each rep is aiming for at least 4 closed deals (signed AND paid) per week. Every grade includes a pace check against this goal — direct, not softened. Compensation rewards acquisition AND expansion: the rep who lands a $99 Launch client gets credit when the account upgrades — sell the relationship, not the transaction.`,
  },
];

/** Insert seed content once (idempotent — keyed on question/title). */
export function seedTrainingContent() {
  const ins = db.prepare('INSERT OR IGNORE INTO training_materials (key, label, content) VALUES (?, ?, ?)');
  for (const m of SEED_MATERIALS) ins.run(m.key, m.label, m.content);
  // Upgrade placeholder/pre-manual rows to the real pricing standard —
  // but never clobber content someone edited by hand in the UI.
  const upd = db.prepare("UPDATE training_materials SET content = ?, label = ?, updated_at = datetime('now') WHERE key = ? AND (content LIKE 'NOT YET PROVIDED%' OR content LIKE 'PRIMARY OFFER: Landing pages%' OR content LIKE 'Each rep is aiming for at least 4 closed deals (signed AND paid) per week. Every grade includes a pace check against this goal — direct, not softened.')");
  for (const m of SEED_MATERIALS) upd.run(m.content, m.label, m.key);
  const faqCount = db.prepare('SELECT COUNT(*) c FROM training_faqs').get().c;
  if (faqCount === 0) {
    const ins = db.prepare('INSERT INTO training_faqs (question, category, rebuttal_points_json) VALUES (?, ?, ?)');
    for (const f of SEED_FAQS) ins.run(f.question, f.category, JSON.stringify(f.rebuttal_points));
  }
  const scenCount = db.prepare('SELECT COUNT(*) c FROM training_scenarios').get().c;
  if (scenCount === 0) {
    const faqs = db.prepare('SELECT id, question FROM training_faqs').all();
    const idFor = (q) => faqs.find((f) => f.question === q)?.id;
    const ins = db.prepare(`
      INSERT INTO training_scenarios (title, persona_json, product_context, target_faq_ids_json, difficulty)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const s of SEED_SCENARIOS) {
      ins.run(s.title, JSON.stringify(s.persona), s.product_context,
        JSON.stringify(s.faq_questions.map(idFor).filter(Boolean)), s.difficulty);
    }
  }
}
