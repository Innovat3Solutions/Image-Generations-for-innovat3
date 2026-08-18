/**
 * INNOVAT3 Sales & Pricing System v2 (Aug 2026) as structured data — the
 * single source of truth that powers:
 *   - the Offers knowledge-base page reps work from
 *   - per-prospect package recommendations in the dashboard
 *   - the in-call Sales Call Guide (diagnose → recommend → add-on check → close)
 *   - the outreach generator and the Practice tab's company materials
 *
 * The ladder: Presence → Reputation → Communication → Automation → Growth
 * → Outsourced Marketing. Diagnose the PRIMARY need, recommend ONE package
 * plus ONE upgrade path; the $99 Launch plan is the standard foot-in-the-door.
 *
 * ECONOMICS (commission, margins) is management-only — never surfaced in
 * rep-facing UI or client-facing proposals. See ECONOMICS at the bottom.
 */

export const PACKAGES = [
  {
    key: 'launch', upgrade_to: 'local', name: 'LAUNCH', stage: 'Presence',
    monthly: 99, setup: 199, usage: false,
    outcome: 'Get the relationship',
    promise: 'Landing page + review access',
    talk_track: '“We start by giving you a clean conversion page and an easy way for customers to leave Google reviews. It is the simplest way to get INNOVAT3 working for you.”',
    included: [
      '1 branded, mobile-responsive landing page',
      'Business info, services, phone, contact CTA and lead form',
      'Google Maps/location integration',
      'Google Review link/button + review QR code',
      'Basic visitor/lead tracking',
      'Hosting, SSL and technical maintenance',
      'Minor text updates within reasonable scope',
    ],
    not_included: ['CRM or pipeline', 'Automated review requests', 'Missed-call text back', 'Email/SMS campaigns', 'AI receptionist', 'Google Business Profile management', 'Social media management', 'Retargeting or reactivation'],
  },
  {
    key: 'local', upgrade_to: 'connect', name: 'LOCAL', stage: 'Reputation',
    monthly: 199, setup: 399, usage: false,
    outcome: 'Build reputation',
    promise: 'Review automation + Google optimization',
    talk_track: '“Local adds the system that actively asks for reviews and improves the way your business shows up on Google.”',
    included: ['Everything in Launch', 'Automated Google review request workflow', 'SMS + email review requests', 'Review funnel and tracking', 'Google Business Profile audit + optimization', 'Enhanced lead form + notifications', 'Basic contact database and source tracking'],
    not_included: ['Full CRM opportunity pipeline', 'AI receptionist', 'Ongoing social content', 'Monthly reactivation campaigns', 'Paid ad management'],
  },
  {
    key: 'connect', upgrade_to: 'ai', name: 'CONNECT', stage: 'Communication',
    monthly: 399, setup: 750, usage: false,
    outcome: 'Capture & follow up',
    promise: 'CRM + pipeline + messaging',
    talk_track: '“Connect gives you the CRM, pipeline and automatic follow-up so leads stop getting lost.”',
    included: ['Everything in Local', 'CRM account + contact management', '1 sales pipeline', '1 appointment calendar', 'Missed-call text back', 'New-lead SMS + email follow-up', 'Appointment confirmations and reminders', 'Up to 3 standard automated workflows', 'Up to 2 nurture sequences', 'Lead source + opportunity tracking'],
    not_included: ['AI receptionist', 'Complex custom automations', 'Multi-location architecture', 'Advanced API integrations', 'Marketing content production'],
  },
  {
    key: 'ai', upgrade_to: 'growth', name: 'AI', stage: 'Automation',
    monthly: 699, setup: 1250, usage: true,
    outcome: 'Answer & convert',
    promise: 'AI receptionist + lead automation',
    talk_track: '“AI adds a 24/7 receptionist that can answer, qualify, route and help book opportunities.”',
    included: ['Everything in Connect', 'Inbound AI voice receptionist', 'Custom greeting + business FAQ knowledge', 'Lead qualification + appointment booking', 'Call routing and transfer logic', 'Call summaries + CRM logging', 'Post-call SMS follow-up', 'After-hours answering', '1 database reactivation campaign per quarter', 'Base AI voice allowance (per proposal)'],
    not_included: ['Unlimited AI voice minutes', 'High-volume outbound voice without approved usage pricing', 'Enterprise integrations', 'Done-for-you social media', 'Paid ad spend'],
  },
  {
    key: 'growth', upgrade_to: 'marketing_team', name: 'GROWTH', stage: 'Growth',
    monthly: 999, setup: 1950, usage: true,
    outcome: 'Create more opportunities',
    promise: 'Reactivation + email + reputation + retargeting',
    talk_track: '“Growth adds campaigns, reactivation, email and retargeting so we are not just capturing opportunities — we are creating more of them.”',
    included: ['Everything in AI', 'Monthly database reactivation campaign', 'Ongoing email marketing / nurture', 'Reputation management + review automation', 'Ongoing Google Business optimization', 'Retargeting infrastructure (Meta/Google pixels + audiences)', 'Up to 10 standard workflows', 'Advanced lead routing + notifications', 'Performance reporting dashboard'],
    not_included: ['Ad spend', 'Full original social content production', 'On-site photo/video production', 'Unlimited campaign volume', 'SEO unless separately contracted'],
  },
  {
    key: 'marketing_team', upgrade_to: 'marketing_growth', name: 'MARKETING TEAM', stage: 'Outsourced Marketing',
    monthly: 1675, setup: 3150, usage: false,
    outcome: 'Outsource growth',
    promise: '12 monthly content pieces + email marketing + management',
    talk_track: '“At $1,675 you are no longer just buying software — you are hiring INNOVAT3 to plan, create, manage and publish your marketing every month, with 12 finished content pieces plus email marketing. You supply the raw photos/video when business-specific media is needed.”',
    included: ['12 original content pieces/month', 'Multi-platform distribution', 'Monthly content calendar + campaign planning', 'Copywriting, captions, CTAs, branded design', 'Editing of client-supplied photos/video', 'Scheduling and publishing', 'Email marketing (strategy, copy, design, campaigns)', 'Google Business content when it fits', 'Monthly performance summary'],
    not_included: ['On-site videography/photography', 'Unlimited content or revisions', 'Paid media spend', 'Long-form video production'],
  },
  {
    key: 'marketing_growth', upgrade_to: 'marketing_pro', name: 'MARKETING GROWTH', stage: 'Outsourced Marketing',
    monthly: 1995, setup: 3150, usage: false,
    outcome: 'Stronger cadence',
    promise: '20 pieces/month + more campaigns',
    talk_track: '“Growth increases the marketing output to 20 pieces per month and gives us more room to run campaigns and maintain a stronger weekly presence.”',
    included: ['Everything in Marketing Team', '20 original content pieces/month', 'Higher weekly cadence', 'More campaign variation + offer support', 'More active monthly optimization'],
    not_included: ['On-site filming', 'Unlimited raw video editing', 'Paid media spend', 'Influencer/talent costs'],
  },
  {
    key: 'marketing_pro', upgrade_to: null, name: 'MARKETING PRO', stage: 'Outsourced Marketing',
    monthly: 2495, setup: 3150, usage: false,
    outcome: 'Near-daily capacity',
    promise: '30 pieces/month + deeper optimization',
    talk_track: '“Pro gives you 30 pieces per month — near-daily capacity — for businesses that can consistently feed us raw media and want INNOVAT3 running the content engine.”',
    included: ['Everything in Marketing Growth', '30 original content pieces/month', 'Daily-content capacity', 'Expanded creative testing + campaign themes', 'Monthly strategy review + deeper reporting', 'Priority planning for launches and seasonal campaigns'],
    not_included: ['On-site videography/photography', 'Paid ad spend', 'Production crews/talent/locations', 'Unlimited content or revisions'],
  },
];

export const ADD_ONS = [
  { name: 'AI Voice Receptionist', price: '$299–$399/mo + usage', note: 'Add to non-AI plans; scoped minutes apply', category: 'AI & Automation', approval: 'Rep can sell within range', timing: 'Initial or expansion', guardrail: 'Usage is additional; scope minutes in proposal.' },
  { name: 'Missed-Call Text Back', price: '$49/mo', note: 'Single-location standard workflow', category: 'AI & Automation', approval: 'Rep can sell', timing: 'Initial or expansion', guardrail: 'Standard single-location workflow only.' },
  { name: 'Review Automation', price: '$79/mo', note: 'Automated SMS/email review requests', category: 'Reputation & Local', approval: 'Rep can sell', timing: 'Initial or expansion', guardrail: 'Standard SMS/email request workflow.' },
  { name: 'Google Business Management', price: '$149–$249/mo', note: 'Ongoing optimization + posting cadence', category: 'Reputation & Local', approval: 'Rep can sell within range', timing: 'Initial or expansion', guardrail: 'Cadence and locations must be defined.' },
  { name: 'Email Marketing', price: '$199–$399/mo', note: 'Depends on frequency/segmentation', category: 'AI & Automation', approval: 'Rep can sell within range', timing: 'Initial or expansion', guardrail: 'Price depends on frequency and segmentation.' },
  { name: 'Database Reactivation', price: '$299/campaign or $199/mo', note: 'Usage charges may apply', category: 'Growth & Nurture', approval: 'Rep can sell', timing: 'Initial or expansion', guardrail: 'Usage charges may apply.' },
  { name: 'Additional Landing Page', price: '$99/mo or $299 build', note: 'Complex funnels quoted separately', category: 'Websites & Funnels', approval: 'Rep can sell', timing: 'Initial or expansion', guardrail: 'Complex funnels quoted separately.' },
  { name: 'Additional Location', price: '$99–$199/mo', note: 'Depends on CRM/phone/GBP needs', category: 'Locations', approval: 'Rep can sell within range', timing: 'Initial', guardrail: 'Depends on CRM, phone, and GBP needs.' },
  { name: 'Retargeting Management', price: '$299–$499/mo + ad spend', note: 'Media spend paid by client', category: 'Advertising', approval: 'Rep can sell within range', timing: '30–90 days', guardrail: 'Ad spend always paid by client.' },
  { name: 'Extra Short-Form Video Editing', price: '$75–$150/video', note: 'From supplied footage', category: 'Content & Creative', approval: 'Rep can sell within range', timing: 'Expansion', guardrail: 'From usable client-supplied footage; advanced edits scoped separately.' },
  { name: 'On-Site Videographer / Content Shoot', price: 'from $750 per shoot day', note: 'Paid add-on to Marketing Team / Growth / Pro — not included in the monthly package', category: 'Content & Creative', approval: 'Rep can sell', timing: 'Initial with marketing package or expansion', guardrail: '$750 per shoot day; multi-day campaigns multiply by days. Travel/special production may require scope approval. Capture can include headshots, team photos, brand/service/testimonial footage, B-roll and short-form social footage.', marketing_only: true },
  { name: 'Community Management', price: '$299–$599/mo', note: 'Defined response windows', category: 'Content & Creative', approval: 'Rep can sell within range', timing: 'Initial or expansion', guardrail: 'Response windows and channels must be defined.' },
];

// Custom / project work — quote AFTER scoping. Everything except the
// standard landing page needs management approval.
export const PROJECTS = [
  { name: 'Additional standard landing page', price: '$299', approval: 'Rep can quote fixed price' },
  { name: '5-page website', price: 'from $1,500', approval: 'Management approval' },
  { name: 'Premium website', price: 'from $2,500', approval: 'Management approval' },
  { name: 'E-commerce website', price: 'from $3,500', approval: 'Management approval' },
  { name: 'CRM migration', price: 'from $750', approval: 'Management approval' },
  { name: 'Custom pipeline build', price: '$500+', approval: 'Management approval' },
  { name: 'Custom automation', price: '$500–$2,500+', approval: 'Management approval' },
  { name: 'Advanced AI agent build', price: 'from $1,500', approval: 'Management approval' },
  { name: 'Database cleanup/import', price: '$300–$1,000', approval: 'Management approval' },
  { name: 'Email campaign build', price: '$300+', approval: 'Management approval' },
  { name: 'Reactivation campaign build', price: '$500+', approval: 'Management approval' },
  { name: 'Google Business cleanup', price: '$300+', approval: 'Management approval' },
  { name: 'Tracking/pixel implementation', price: '$300+', approval: 'Management approval' },
  { name: 'Funnel build', price: '$750–$1,500+', approval: 'Management approval' },
  { name: 'Custom API/integration', price: 'from $1,500', approval: 'Management approval' },
];

/**
 * MANAGEMENT ONLY — never ship to rep-facing UI or client proposals.
 * Served exclusively through the admin-gated economics endpoint.
 */
export const ECONOMICS = {
  standard_commission: 0.20,
  commission_free: ['On-Site Videographer / Content Shoot'],
  guardrails: [
    'Any custom quote or discount that falls below the company’s approved minimum gross margin requires management approval.',
    'Do not guess profitability from revenue alone.',
    'Track labor, software, AI/phone usage, contractors, ad-management burden, account management, and commission against each offer — replace the workbook’s zeros with real delivery costs.',
  ],
};

/**
 * Sales Call Guide STEP 1 — diagnose the PRIMARY need. Six ask/listen-for
 * questions, each pointing at one primary package. rep_says is the pitch
 * line for that recommendation; do_not is the guardrail.
 */
export const QUALIFICATION = [
  { key: 'presence', area: 'Presence', question: 'Do they have a professional web presence?', points_to: 'launch',
    rep_says: 'Get the business online correctly and make it easy for customers to take action.',
    do_not: 'Do not stack add-ons before solving presence.' },
  { key: 'reputation', area: 'Reputation', question: 'Are reviews / Google visibility a problem?', points_to: 'local',
    rep_says: 'Build reviews and visibility, then capture the leads that result.',
    do_not: 'Do not jump to AI unless call/lead volume justifies it.' },
  { key: 'crm_follow_up', area: 'CRM / Follow-Up', question: 'Are leads falling through the cracks?', points_to: 'connect',
    rep_says: 'Centralize leads, automate follow-up, and stop opportunities from being lost.',
    do_not: 'Avoid custom automation before standard workflows are exhausted.' },
  { key: 'ai_calls', area: 'AI / Calls', question: 'Are calls missed or staff overloaded?', points_to: 'ai',
    rep_says: 'Answer, qualify, book, route, and follow up — even after hours.',
    do_not: 'Never imply unlimited usage.' },
  { key: 'growth', area: 'Growth', question: 'Do they need more opportunities from their database?', points_to: 'growth',
    rep_says: 'Create more opportunities from existing leads and ongoing nurture.',
    do_not: 'Do not promise paid media spend is included.' },
  { key: 'full_marketing', area: 'Full Marketing', question: 'Do they want INNOVAT3 handling content + marketing?', points_to: 'marketing_team',
    rep_says: 'We become the execution layer for content, campaigns, and ongoing marketing.',
    do_not: 'Do not promise unlimited content/revisions.' },
];

/**
 * Sales Call Guide STEP 3 — essential add-on check. Asked only AFTER the
 * core package is selected; each yes maps to one add-on (or scoped work).
 */
export const ESSENTIAL_ADDONS = [
  { key: 'content_shoot', question: 'Marketing package: do they lack enough professional photo/video content?', addon: 'On-Site Videographer / Content Shoot',
    when: 'Offer on top of Marketing Team / Growth / Pro when the client lacks a usable content library.' },
  { key: 'extra_page', question: 'Do they need another offer, page, or funnel?', addon: 'Additional Landing Page',
    when: 'A specific campaign, offer, or location needs its own destination.' },
  { key: 'locations', question: 'Are there multiple business locations?', addon: 'Additional Location',
    when: 'Each extra location needs CRM/phone/GBP support.' },
  { key: 'paid_ads', question: 'Do they need faster lead acquisition with paid ads?', addon: 'Retargeting Management',
    when: 'Client has a clear offer, tracking, and budget.' },
  { key: 'custom_work', question: 'Do they need custom workflows or integrations?', addon: null, scoped: 'Custom Automation / API',
    when: 'Standard workflows cannot solve the requirement — management approval, quoted after scoping.' },
  { key: 'more_content', question: 'Do they need more content output than the package includes?', addon: 'Extra Short-Form Video Editing',
    when: 'Demand exceeds included content capacity — or move up a marketing tier.' },
];

/** Sales Call Guide STEP 4 — close cleanly. */
export const CLOSE_CHECKLIST = [
  'Confirm the primary outcome: “The main thing we are solving first is ______.”',
  'Confirm package + setup — state the monthly price and setup fee separately.',
  'Confirm essential add-ons — only ones tied directly to a stated need.',
  'Set boundaries — usage, ad spend, revisions, custom work, travel, and multi-day shoots are separate where applicable.',
  'Document expansion opportunities — do not force them into the first deal; schedule future account reviews.',
];

/** Sales Call Guide STEP 5 — expansion rhythm after the close. */
export const EXPANSION_RHYTHM = [
  { timing: 'Onboarding', review: 'Missing essentials', expansion: 'Setup add-ons, location, migration', purpose: 'Remove blockers to a successful launch.' },
  { timing: '30 days', review: 'Content quality + lead handling', expansion: 'Videographer, extra editing, AI/CRM upgrade', purpose: 'For marketing clients, refresh the content library when original footage is the bottleneck.' },
  { timing: '60–90 days', review: 'Lead flow + campaigns', expansion: 'Retargeting, reactivation, landing pages', purpose: 'Create more opportunities after foundations are working.' },
  { timing: 'Quarterly', review: 'Performance + seasonality', expansion: 'New shoot, seasonal campaign, higher tier', purpose: 'Grow account value based on actual business needs.' },
  { timing: '6–12 months', review: 'System maturity', expansion: 'Website refresh, custom automation, additional locations', purpose: 'Expand strategically rather than discounting the core plan.' },
];

export const UPGRADE_TRIGGERS = [
  { from: 'Launch', to: 'Local', trigger: 'Needs more Google reviews, automated review requests, or Google Business optimization' },
  { from: 'Local', to: 'Connect', trigger: 'Leads coming in but follow-up is inconsistent; appointments missed; needs a pipeline' },
  { from: 'Connect', to: 'AI', trigger: 'Call volume missed, no after-hours coverage, wants automated qualification/booking' },
  { from: 'AI', to: 'Growth', trigger: 'Old leads to reactivate, needs email/campaigns, wants retargeting infrastructure' },
  { from: 'Growth', to: 'Marketing Team', trigger: 'Needs INNOVAT3 to own strategy, creative, publishing, email at 12 pieces/month' },
  { from: 'Marketing Team', to: 'Marketing Growth', trigger: 'Wants >12 monthly pieces and a stronger weekly presence' },
  { from: 'Marketing Growth', to: 'Marketing Pro', trigger: 'Needs near-daily content and can supply enough raw media' },
];

export const RULES = [
  'Lead with the LOWEST package that solves the immediate problem — do not over-prescribe. The $99 Launch plan is the standard foot-in-the-door.',
  'Explain only the recommended package and, at most, the next logical upgrade — never all eight at once.',
  'Bundling rule: if current package + add-ons ≥ the next package, position the upgrade instead (e.g. Connect $399 + AI Voice $399 = $798 → sell AI at $699).',
  'Every proposal separates recurring fees, one-time implementation, usage/third-party costs, and optional add-ons.',
  'Advertising spend is always paid separately by the client.',
  'No unlimited anything (content, automations, revisions, AI usage, locations) unless explicitly contracted.',
  'On-site videography/photography is NOT included in marketing tiers — the client supplies raw media; INNOVAT3 turns it into finished content.',
  'Custom software, API work, migrations and unusual production go through INNOVAT3 Custom Solutions with a scoped proposal.',
];

export function packageByKey(key) {
  return PACKAGES.find((p) => p.key === key) || PACKAGES[0];
}

/**
 * Live package builder for the Sales Call Guide. The rep checks off the
 * diagnosed needs (QUALIFICATION keys) and the essential add-on answers
 * (ESSENTIAL_ADDONS keys), and this assembles the recommendation per the
 * System's rules: ONE primary package (the highest rung any diagnosed need
 * points to — "everything in X" absorbs the rungs below) + ONE upgrade
 * path, add-ons only for diagnosed extras, custom work flagged for scoping,
 * recurring / one-time / usage separated. NO economics — client-safe.
 */
export function buildProposal(prospect, discovery = {}) {
  const checked = Array.isArray(discovery.checked) ? discovery.checked : [];
  const extras = Array.isArray(discovery.extras) ? discovery.extras : [];
  const ladder = PACKAGES.map((p) => p.key);

  // STEP 1+2: highest rung any diagnosed need points to = the primary
  let pkgKey = 'launch';
  let primaryNeed = null;
  for (const item of QUALIFICATION) {
    if (checked.includes(item.key) && ladder.indexOf(item.points_to) >= ladder.indexOf(pkgKey)) {
      pkgKey = item.points_to;
      primaryNeed = item;
    }
  }
  const pkg = packageByKey(pkgKey);
  const upgrade = pkg.upgrade_to ? packageByKey(pkg.upgrade_to) : null;

  // STEP 3: essential add-on answers → add-ons (or scoped custom work)
  const essentials = ESSENTIAL_ADDONS.filter((e) => extras.includes(e.key));
  const addons = essentials.filter((e) => e.addon && !(e.key === 'content_shoot' && !/^marketing/.test(pkgKey)))
    .map((e) => ADD_ONS.find((a) => a.name === e.addon)).filter(Boolean);
  const scoped = essentials.filter((e) => e.scoped).map((e) => e.scoped);

  const addonLow = (price) => Number((String(price).match(/\$(\d[\d,]*)/) || [])[1]?.replace(/,/g, '') || 0);
  const addonMonthly = addons.reduce((sum, a) => sum + (/\/mo/.test(a.price) ? addonLow(a.price) : 0), 0);
  const oneTime = addons.filter((a) => !/\/mo/.test(a.price));

  // Bundling rule: package + monthly add-ons ≥ next rung → position the upgrade
  const next = PACKAGES[ladder.indexOf(pkgKey) + 1] || null;
  const bundleUpgrade = next && addonMonthly > 0 && pkg.monthly + addonMonthly >= next.monthly
    ? { name: next.name, monthly: next.monthly, saving: pkg.monthly + addonMonthly - next.monthly }
    : null;

  const needs = QUALIFICATION.filter((q) => checked.includes(q.key)).map((q) => q.area);
  const guardrails = QUALIFICATION.filter((q) => checked.includes(q.key)).map((q) => q.do_not);
  return {
    needs,
    guardrails,
    package: {
      key: pkg.key, name: pkg.name, monthly: pkg.monthly, setup: pkg.setup,
      usage: pkg.usage, promise: pkg.promise, talk_track: pkg.talk_track, included: pkg.included,
      rep_says: primaryNeed?.rep_says || pkg.outcome,
    },
    upgrade: upgrade ? { key: upgrade.key, name: upgrade.name, monthly: upgrade.monthly, setup: upgrade.setup, promise: upgrade.promise } : null,
    addons: addons.map((a) => ({ name: a.name, price: a.price, note: a.note, approval: a.approval })),
    scoped_items: scoped,
    monthly_total: pkg.monthly + addonMonthly,
    monthly_is_from: addons.some((a) => /–|\+|from/.test(a.price)),
    setup_total: pkg.setup,
    one_time_addons: oneTime.map((a) => `${a.name} (${a.price})`),
    bundle_upgrade: bundleUpgrade,
  };
}

/** The copy-ready pricing guide the rep reads from / sends after the call. */
export function proposalText(prospect, proposal, rep = '') {
  const biz = prospect.dba_name || prospect.business_name;
  const p = proposal;
  const lines = [
    `INNOVAT3 SOLUTIONS — PROPOSAL FOR ${biz.toUpperCase()}`,
    rep ? `Prepared by ${rep}` : null,
    '',
    p.needs.length ? `WHAT YOU TOLD US YOU NEED\n${p.needs.map((n) => `  • ${n}`).join('\n')}` : null,
    '',
    `YOUR PACKAGE: ${p.package.name} — $${p.package.monthly}/mo · $${p.package.setup} one-time setup${p.package.usage ? ' · plus usage per proposal' : ''}`,
    `${p.package.promise}`,
    '',
    `EVERYTHING INCLUDED:`,
    ...p.package.included.map((i) => `  ✓ ${i}`),
    p.addons.length ? `\nADD-ONS FOR YOUR EXTRAS:\n${p.addons.map((a) => `  + ${a.name} — ${a.price}${a.note ? ` (${a.note})` : ''}`).join('\n')}` : null,
    p.scoped_items.length ? `\nSCOPED SEPARATELY (we'll quote after a quick scoping call):\n${p.scoped_items.map((s) => `  ◦ ${s}`).join('\n')}` : null,
    '',
    `YOUR INVESTMENT`,
    `  Recurring: ${p.monthly_is_from ? 'from ' : ''}$${p.monthly_total}/mo`,
    `  One-time setup: $${p.setup_total}${p.one_time_addons.length ? ` (plus ${p.one_time_addons.join(', ')})` : ''}`,
    `  Ad spend and usage-based costs are always separate and itemized.`,
    p.bundle_upgrade ? `\nWORTH KNOWING: your package plus add-ons crosses $${p.bundle_upgrade.monthly} — the ${p.bundle_upgrade.name} plan covers it all natively${p.bundle_upgrade.saving > 0 ? ` and saves you $${p.bundle_upgrade.saving}/mo` : ' for the same money'}. Ask ${rep ? rep.split(' ')[0] : 'us'} to walk you through it.` : null,
    p.upgrade ? `\nWHEN YOU'RE READY FOR MORE: the natural next step is ${p.upgrade.name} — ${p.upgrade.promise} ($${p.upgrade.monthly}/mo + $${p.upgrade.setup} setup). No pressure; we'll review together at your account check-ins.` : null,
    '',
    `No long-term contracts. We earn the next month every month.`,
  ];
  return lines.filter((l) => l !== null).join('\n');
}

const j = (s, fb = null) => { try { return s ? JSON.parse(s) : fb; } catch { return fb; } };

/**
 * Map a prospect's detected signals to the ladder. Per the standard, the
 * entry is Launch ($99) for the vast majority — a higher entry is only
 * suggested when the prospect demonstrably already owns that layer.
 * Returns { entry, why, path: [{key,name,monthly,trigger}] }.
 */
export function recommendOffer(prospect) {
  const signals = j(prospect.site_signals_json);
  const hasSite = !!prospect.website;
  const quality = signals?.quality ?? 0;

  let entryKey = 'launch';
  let why;
  if (!hasSite) {
    why = 'No website found — they need presence first. Classic $99 Launch: conversion page + review link, easiest first yes.';
  } else if (quality < 60) {
    why = `Their site scores ${quality}/100 — pitch Launch as the clean conversion page that replaces what is leaking leads, plus the review link.`;
  } else if (prospect.google_rating != null && prospect.google_rating < 4.2) {
    entryKey = 'local';
    why = `Site is fine but their Google rating is ${prospect.google_rating}★${prospect.google_reviews != null ? ` over ${prospect.google_reviews} reviews` : ''} — enter on reputation repair: automated review requests + Google optimization.`;
  } else if (prospect.google_reviews != null && prospect.google_reviews < 15) {
    entryKey = 'local';
    why = `Established with a website but only ${prospect.google_reviews} Google review${prospect.google_reviews === 1 ? '' : 's'} — nobody is asking their customers. Enter on the review engine.`;
  } else if (!signals?.hasCrm && !signals?.hasBooking) {
    if (prospect.google_rating >= 4.2 && (prospect.google_reviews ?? 0) >= 15) {
      entryKey = 'connect';
      why = `Site and reviews are both healthy (${prospect.google_rating}★ over ${prospect.google_reviews}) — the gap is what happens AFTER the lead: CRM, pipeline, missed-call text back.`;
    } else {
      entryKey = 'local';
      why = 'Decent site already in place — enter on reputation: automated review requests + Google optimization. (Launch still works if they balk at $199.)';
    }
  } else {
    entryKey = 'connect';
    why = 'They already have presence and booking — the gap is capture & follow-up: CRM, pipeline, missed-call text back.';
  }

  // Upsell path from the entry, each step tied to a detected trigger when we have one
  const ladder = ['launch', 'local', 'connect', 'ai', 'growth', 'marketing_team'];
  const start = ladder.indexOf(entryKey);
  const triggersBySignal = {
    local: 'New business → reviews are the trust engine; automate the asking',
    connect: signals?.hasForm && !signals?.hasChat ? 'Their form has no follow-up behind it — leads are going cold' : 'Once leads flow, follow-up is the next leak',
    ai: prospect.phone && !signals?.hasChat ? 'Phone-centric with no after-hours coverage — every missed call is a lost job' : 'Missed calls / after-hours answering',
    growth: 'Once capture works: reactivation, email and retargeting create MORE opportunities',
    marketing_team: 'When they ask “can you just run our marketing?” — 12 pieces/mo + email',
  };
  const path = ladder.slice(start, start + 4).map((k) => {
    const p = packageByKey(k);
    return { key: k, name: p.name, monthly: p.monthly, setup: p.setup, trigger: k === entryKey ? why : (triggersBySignal[k] || p.outcome) };
  });

  const entry = packageByKey(entryKey);
  return {
    entry: { key: entry.key, name: entry.name, monthly: entry.monthly, setup: entry.setup, talk_track: entry.talk_track, promise: entry.promise },
    why,
    path,
  };
}
