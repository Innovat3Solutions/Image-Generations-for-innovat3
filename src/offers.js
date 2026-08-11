/**
 * INNOVAT3 Company Pricing Standard v1.1 (Aug 2026) as structured data —
 * the single source of truth that powers:
 *   - the Offers knowledge-base page reps work from
 *   - per-prospect package recommendations in the dashboard
 *   - the outreach generator
 *   - the Practice tab's company materials
 *
 * The ladder: Presence → Reputation → Communication → Automation → Growth
 * → Outsourced Marketing. Lead with the LOWEST package that solves the
 * immediate problem; the $99 Launch plan is the standard foot-in-the-door.
 */

export const PACKAGES = [
  {
    key: 'launch', name: 'LAUNCH', stage: 'Presence',
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
    key: 'local', name: 'LOCAL', stage: 'Reputation',
    monthly: 199, setup: 399, usage: false,
    outcome: 'Build reputation',
    promise: 'Review automation + Google optimization',
    talk_track: '“Local adds the system that actively asks for reviews and improves the way your business shows up on Google.”',
    included: ['Everything in Launch', 'Automated Google review request workflow', 'SMS + email review requests', 'Review funnel and tracking', 'Google Business Profile audit + optimization', 'Enhanced lead form + notifications', 'Basic contact database and source tracking'],
    not_included: ['Full CRM opportunity pipeline', 'AI receptionist', 'Ongoing social content', 'Monthly reactivation campaigns', 'Paid ad management'],
  },
  {
    key: 'connect', name: 'CONNECT', stage: 'Communication',
    monthly: 399, setup: 750, usage: false,
    outcome: 'Capture & follow up',
    promise: 'CRM + pipeline + messaging',
    talk_track: '“Connect gives you the CRM, pipeline and automatic follow-up so leads stop getting lost.”',
    included: ['Everything in Local', 'CRM account + contact management', '1 sales pipeline', '1 appointment calendar', 'Missed-call text back', 'New-lead SMS + email follow-up', 'Appointment confirmations and reminders', 'Up to 3 standard automated workflows', 'Up to 2 nurture sequences', 'Lead source + opportunity tracking'],
    not_included: ['AI receptionist', 'Complex custom automations', 'Multi-location architecture', 'Advanced API integrations', 'Marketing content production'],
  },
  {
    key: 'ai', name: 'AI', stage: 'Automation',
    monthly: 699, setup: 1250, usage: true,
    outcome: 'Answer & convert',
    promise: 'AI receptionist + lead automation',
    talk_track: '“AI adds a 24/7 receptionist that can answer, qualify, route and help book opportunities.”',
    included: ['Everything in Connect', 'Inbound AI voice receptionist', 'Custom greeting + business FAQ knowledge', 'Lead qualification + appointment booking', 'Call routing and transfer logic', 'Call summaries + CRM logging', 'Post-call SMS follow-up', 'After-hours answering', '1 database reactivation campaign per quarter', 'Base AI voice allowance (per proposal)'],
    not_included: ['Unlimited AI voice minutes', 'High-volume outbound voice without approved usage pricing', 'Enterprise integrations', 'Done-for-you social media', 'Paid ad spend'],
  },
  {
    key: 'growth', name: 'GROWTH', stage: 'Growth',
    monthly: 999, setup: 1950, usage: true,
    outcome: 'Create more opportunities',
    promise: 'Reactivation + email + reputation + retargeting',
    talk_track: '“Growth adds campaigns, reactivation, email and retargeting so we are not just capturing opportunities — we are creating more of them.”',
    included: ['Everything in AI', 'Monthly database reactivation campaign', 'Ongoing email marketing / nurture', 'Reputation management + review automation', 'Ongoing Google Business optimization', 'Retargeting infrastructure (Meta/Google pixels + audiences)', 'Up to 10 standard workflows', 'Advanced lead routing + notifications', 'Performance reporting dashboard'],
    not_included: ['Ad spend', 'Full original social content production', 'On-site photo/video production', 'Unlimited campaign volume', 'SEO unless separately contracted'],
  },
  {
    key: 'marketing_team', name: 'MARKETING TEAM', stage: 'Outsourced Marketing',
    monthly: 1675, setup: 3150, usage: false,
    outcome: 'Outsource growth',
    promise: '12 monthly content pieces + email marketing + management',
    talk_track: '“At $1,675 you are no longer just buying software — you are hiring INNOVAT3 to plan, create, manage and publish your marketing every month, with 12 finished content pieces plus email marketing. You supply the raw photos/video when business-specific media is needed.”',
    included: ['12 original content pieces/month', 'Multi-platform distribution', 'Monthly content calendar + campaign planning', 'Copywriting, captions, CTAs, branded design', 'Editing of client-supplied photos/video', 'Scheduling and publishing', 'Email marketing (strategy, copy, design, campaigns)', 'Google Business content when it fits', 'Monthly performance summary'],
    not_included: ['On-site videography/photography', 'Unlimited content or revisions', 'Paid media spend', 'Long-form video production'],
  },
  {
    key: 'marketing_growth', name: 'MARKETING GROWTH', stage: 'Outsourced Marketing',
    monthly: 1995, setup: 3150, usage: false,
    outcome: 'Stronger cadence',
    promise: '20 pieces/month + more campaigns',
    talk_track: '“Growth increases the marketing output to 20 pieces per month and gives us more room to run campaigns and maintain a stronger weekly presence.”',
    included: ['Everything in Marketing Team', '20 original content pieces/month', 'Higher weekly cadence', 'More campaign variation + offer support', 'More active monthly optimization'],
    not_included: ['On-site filming', 'Unlimited raw video editing', 'Paid media spend', 'Influencer/talent costs'],
  },
  {
    key: 'marketing_pro', name: 'MARKETING PRO', stage: 'Outsourced Marketing',
    monthly: 2495, setup: 3150, usage: false,
    outcome: 'Near-daily capacity',
    promise: '30 pieces/month + deeper optimization',
    talk_track: '“Pro gives you 30 pieces per month — near-daily capacity — for businesses that can consistently feed us raw media and want INNOVAT3 running the content engine.”',
    included: ['Everything in Marketing Growth', '30 original content pieces/month', 'Daily-content capacity', 'Expanded creative testing + campaign themes', 'Monthly strategy review + deeper reporting', 'Priority planning for launches and seasonal campaigns'],
    not_included: ['On-site videography/photography', 'Paid ad spend', 'Production crews/talent/locations', 'Unlimited content or revisions'],
  },
];

export const ADD_ONS = [
  { name: 'AI Voice Receptionist', price: '$299–$399/mo + usage', note: 'Add to non-AI plans; scoped minutes apply' },
  { name: 'Missed-Call Text Back', price: '$49/mo', note: 'Single-location standard workflow' },
  { name: 'Review Automation', price: '$79/mo', note: 'Automated SMS/email review requests' },
  { name: 'Google Business Management', price: '$149–$249/mo', note: 'Ongoing optimization + posting cadence' },
  { name: 'Email Marketing', price: '$199–$399/mo', note: 'Depends on frequency/segmentation' },
  { name: 'Database Reactivation', price: '$299/campaign or $199/mo', note: 'Usage charges may apply' },
  { name: 'Additional Landing Page', price: '$99/mo or $299 build', note: 'Complex funnels quoted separately' },
  { name: 'Additional Location', price: '$99–$199/mo', note: 'Depends on CRM/phone/GBP needs' },
  { name: 'Retargeting Management', price: '$299–$499/mo + ad spend', note: 'Media spend paid by client' },
  { name: 'Extra Short-Form Video Editing', price: '$75–$150/video', note: 'From supplied footage' },
  { name: 'Community Management', price: '$299–$599/mo', note: 'Defined response windows' },
];

export const PROJECTS = [
  { name: 'Additional standard landing page', price: '$299' },
  { name: '5-page website', price: 'from $1,500' },
  { name: 'Premium website', price: 'from $2,500' },
  { name: 'E-commerce website', price: 'from $3,500' },
  { name: 'CRM migration', price: 'from $750' },
  { name: 'Custom pipeline build', price: '$500+' },
  { name: 'Custom automation', price: '$500–$2,500+' },
  { name: 'Advanced AI agent build', price: 'from $1,500' },
  { name: 'Database cleanup/import', price: '$300–$1,000' },
  { name: 'Email campaign build', price: '$300+' },
  { name: 'Reactivation campaign build', price: '$500+' },
  { name: 'Google Business cleanup', price: '$300+' },
  { name: 'Tracking/pixel implementation', price: '$300+' },
  { name: 'Funnel build', price: '$750–$1,500+' },
  { name: 'Custom API/integration', price: 'from $1,500' },
];

export const QUALIFICATION = [
  { area: 'Website / presence', question: 'Do you have a simple page that clearly tells people what you do and gives them a way to contact you?', points_to: 'launch' },
  { area: 'Reviews', question: 'How are you currently asking customers for Google reviews?', points_to: 'local' },
  { area: 'Lead capture', question: 'Where do new leads go when someone fills out a form, calls or messages you?', points_to: 'connect' },
  { area: 'Follow-up', question: 'What happens if your team misses a call or does not reach a lead the first time?', points_to: 'connect' },
  { area: 'Phone coverage', question: 'Who answers after hours, during lunch, or when the team is busy?', points_to: 'ai' },
  { area: 'Old database', question: 'How many past leads or customers are sitting in your database without active follow-up?', points_to: 'growth' },
  { area: 'Marketing', question: 'Who currently plans, creates, schedules and publishes your marketing?', points_to: 'marketing_team' },
  { area: 'Content supply', question: 'Can your team consistently send us photos, raw video, testimonials and business updates each month?', points_to: 'marketing_growth' },
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
  } else if (!signals?.hasCrm && !signals?.hasBooking) {
    entryKey = 'local';
    why = 'Decent site already in place — enter on reputation: automated review requests + Google optimization. (Launch still works if they balk at $199.)';
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
