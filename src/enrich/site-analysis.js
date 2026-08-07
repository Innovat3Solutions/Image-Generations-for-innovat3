/**
 * Website signal analysis — turns "they have a website" into "here is what
 * their website is missing", which is the pitch.
 *
 * Detected from the homepage HTML (no extra requests):
 *   booking   — online scheduling (Calendly, Housecall Pro, ServiceTitan…)
 *   chat      — live chat / AI chat widgets (Intercom, Podium, Tawk…)
 *   forms     — any lead-capture form
 *   mobile    — responsive viewport meta
 *   freshness — stale copyright years, dated builders
 *   platform  — WordPress / Wix / Squarespace / custom
 *   crm       — HubSpot / Salesforce pixels
 *
 * Produces site quality (0-100) + the signal map stored on the prospect.
 */

const SIGNALS = {
  booking: /calendly|acuityscheduling|housecallpro|servicetitan|jobber|getjobber|workiz|schedulicity|squareup\.com\/appointments|booksy|vagaro|mindbody|janeapp|zocdoc|localmed|nexhealth|setmore|simplybook|appointy|book(?:ing)?[-_ ]?(?:online|now|appointment)/i,
  chat: /intercom|drift\.com|tawk\.to|livechat|zendesk.*(widget|chat)|crisp\.chat|tidio|podium|birdeye|smith\.ai|hubspot.*conversations|facebook\.com\/plugins\/customerchat|manychat|chatbot|gorgias/i,
  crm: /hubspot|hs-scripts|salesforce|pardot|activecampaign|keap\.com|infusionsoft|gohighlevel|leadconnector|pipedrive|zoho.*crm/i,
  analytics: /googletagmanager|gtag\(|google-analytics|fbq\(|facebook\.net\/.*fbevents|clarity\.ms/i,
};

const PLATFORMS = [
  [/wp-content|wp-includes|wordpress/i, 'wordpress'],
  [/wixstatic|wix\.com|_wixCIDX/i, 'wix'],
  [/squarespace/i, 'squarespace'],
  [/godaddy.*website|websitebuilder\.godaddy/i, 'godaddy-builder'],
  [/webflow/i, 'webflow'],
  [/shopify/i, 'shopify'],
  [/duda(mobile)?/i, 'duda'],
  [/yolasite|weebly|site123|strikingly/i, 'free-builder'],
];

export function analyzeSite(html) {
  if (!html) return null;
  const s = {
    hasBooking: SIGNALS.booking.test(html),
    hasChat: SIGNALS.chat.test(html),
    hasCrm: SIGNALS.crm.test(html),
    hasAnalytics: SIGNALS.analytics.test(html),
    hasForm: /<form[\s>]/i.test(html) || /typeform|jotform|gravityforms|wpforms|formstack/i.test(html),
    mobileViewport: /<meta[^>]+name=["']viewport["'][^>]*width=device-width/i.test(html),
    hasSsl: true, // we only accept https sites in discovery
    platform: (PLATFORMS.find(([re]) => re.test(html)) || [null, 'custom'])[1],
  };

  // Freshness: latest copyright year on the page
  const years = [...html.matchAll(/(?:©|&copy;|copyright)[^0-9]{0,20}(20\d{2})/gi)].map((m) => Number(m[1]));
  const latestYear = years.length ? Math.max(...years) : null;
  const currentYear = new Date().getFullYear();
  s.copyrightYear = latestYear;
  s.looksStale = latestYear !== null && currentYear - latestYear >= 2;

  // Site quality 0-100: what a modern lead-generating site should have
  let q = 30; // has a working site at all
  if (s.mobileViewport) q += 15;
  if (s.hasForm) q += 15;
  if (s.hasBooking) q += 15;
  if (s.hasChat) q += 10;
  if (s.hasAnalytics) q += 5;
  if (s.hasCrm) q += 5;
  if (!s.looksStale) q += 5;
  if (s.platform === 'free-builder') q -= 15;
  s.quality = Math.max(0, Math.min(100, q));
  return s;
}
