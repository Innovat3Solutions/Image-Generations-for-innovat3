/**
 * INNOVAT3's target verticals — the industries where a new client is
 * valuable, follow-up matters, and operational inefficiency costs money.
 *
 * Each vertical carries the scoring inputs for the Opportunity Score:
 *   value      (0-20)  commercial value — typical ticket / ability to pay
 *   automation (0-15)  how lead/schedule/workflow-driven the business is
 * and the classification hooks that map raw source records to a vertical:
 *   dbprCodes        DBPR license-code prefixes
 *   nppesTaxonomies  NPI taxonomy-code prefixes
 *   osmCategories    OSM category keys (config.osm.categories)
 *   nameKeywords     matched against business names (Sunbiz has no industry)
 */
export const VERTICALS = {
  roofing: {
    label: 'Roofing', priority: 1, value: 18, automation: 14,
    dbprCodes: ['CCC'],
    nameKeywords: ['roofing', 'roof repair', 'roofer'],
  },
  hvac: {
    label: 'HVAC', priority: 1, value: 18, automation: 14,
    dbprCodes: ['CAC', 'CMC'],
    nameKeywords: ['hvac', 'air conditioning', 'a/c ', 'cooling and heating', 'heating and cooling', 'heating & cooling', 'air & heat', 'heat and air'],
  },
  plumbing: {
    label: 'Plumbing', priority: 1, value: 16, automation: 14,
    dbprCodes: ['CFC', 'RF'],
    nameKeywords: ['plumbing', 'plumber', 'drain', 'septic'],
  },
  electrical: {
    label: 'Electrical', priority: 1, value: 16, automation: 13,
    dbprCodes: ['EC', 'ES', 'EF', 'EG'],
    nameKeywords: ['electric', 'electrical services', 'electrician'],
  },
  general_contractors: {
    label: 'General Contractors / Remodelers', priority: 2, value: 17, automation: 13,
    dbprCodes: ['CGC', 'CBC', 'CRC', 'CPC', 'CUC', 'CSC'],
    nameKeywords: ['construction', 'contracting', 'builders', 'remodeling', 'renovation', 'restoration'],
  },
  law_firms: {
    label: 'Law Firms', priority: 3, value: 20, automation: 15,
    nameKeywords: ['law firm', 'law group', 'law office', 'attorneys', 'attorney at law', 'legal services', ' p.a.', ' pllc', 'trial lawyers', 'law, p'],
    nameKeywordsRequireAll: false,
  },
  med_spas: {
    label: 'Med Spas / Cosmetic Clinics', priority: 4, value: 19, automation: 15,
    nppesTaxonomies: ['207N', '2082', '163WD'], // dermatology, plastic surgery, derm nursing
    nameKeywords: ['med spa', 'medspa', 'medical spa', 'aesthetics', 'cosmetic', 'botox', 'skin clinic', 'laser clinic', 'wellness clinic', 'rejuvenation'],
  },
  dental: {
    label: 'Dentists / Orthodontists', priority: 5, value: 19, automation: 14,
    nppesTaxonomies: ['1223', '124Q'], // dentists, dental hygiene/assistants
    nameKeywords: ['dental', 'dentistry', 'orthodontic', 'dentist'],
  },
  real_estate: {
    label: 'Real Estate Brokerages & Teams', priority: 6, value: 14, automation: 13,
    nameKeywords: ['realty', 'real estate', 'brokerage', 'properties group'],
  },
  property_management: {
    label: 'Property Management', priority: 7, value: 15, automation: 14,
    nameKeywords: ['property management', 'property managers'],
  },
  accounting: {
    label: 'Accounting / Tax / Bookkeeping', priority: 8, value: 14, automation: 14,
    nameKeywords: ['accounting', 'bookkeeping', 'tax service', 'tax services', 'cpa firm', 'tax prep'],
  },
  insurance: {
    label: 'Insurance Agencies', priority: 9, value: 14, automation: 13,
    nameKeywords: ['insurance agency', 'insurance group', 'insurance services'],
  },
  auto_repair: {
    label: 'Auto Repair / Collision', priority: 10, value: 12, automation: 12,
    osmCategories: ['auto'],
    nameKeywords: ['auto repair', 'collision', 'auto body', 'automotive repair', 'tire shop'],
  },
  fitness: {
    label: 'Gyms / Fitness Studios', priority: 11, value: 11, automation: 12,
    osmCategories: ['fitness'],
    nameKeywords: ['fitness', 'gym', 'crossfit', 'pilates', 'yoga studio', 'martial arts'],
  },
  home_services: {
    label: 'Cleaning / Landscaping / Pest Control', priority: 12, value: 11, automation: 13,
    nameKeywords: ['cleaning', 'landscaping', 'lawn care', 'pest control', 'pressure washing', 'pool service', 'maid service', 'janitorial'],
  },
  healthcare: {
    label: 'Healthcare Practices', priority: 13, value: 16, automation: 13,
    nppesTaxonomies: [], // catch-all for NPPES rows not matching a sharper vertical
  },
  restaurants: {
    label: 'Restaurants / Hospitality', priority: 15, value: 8, automation: 10,
    osmCategories: ['restaurants'],
  },
};

// Defaults for records that don't classify into a vertical
export const DEFAULT_VERTICAL_WEIGHTS = { value: 8, automation: 8 };

/** Map a DBPR license code (e.g. "CCC1330911" or "CAC") to a vertical key. */
export function verticalFromDbprCode(licCode) {
  if (!licCode) return null;
  const code = licCode.toUpperCase();
  for (const [key, v] of Object.entries(VERTICALS)) {
    if (v.dbprCodes?.some((c) => code.startsWith(c))) return key;
  }
  return null;
}

/** Map an NPI taxonomy code (e.g. "1223G0001X") to a vertical key. */
export function verticalFromNppesTaxonomy(tax) {
  if (!tax) return 'healthcare';
  for (const [key, v] of Object.entries(VERTICALS)) {
    if (v.nppesTaxonomies?.some((p) => p && tax.startsWith(p))) return key;
  }
  return 'healthcare';
}

/** Classify a business by name (Sunbiz filings carry no industry). */
export function verticalFromName(name) {
  if (!name) return null;
  const s = ' ' + name.toLowerCase() + ' ';
  for (const [key, v] of Object.entries(VERTICALS)) {
    if (v.nameKeywords?.some((k) => s.includes(k))) return key;
  }
  return null;
}

export function verticalMeta(key) {
  return VERTICALS[key] || null;
}
