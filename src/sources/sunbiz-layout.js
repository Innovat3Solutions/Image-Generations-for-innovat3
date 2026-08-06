/**
 * Official fixed-width layout of Sunbiz COR data files (daily + quarterly).
 * Source: Florida Division of Corporations, "Corporate File Definitions"
 * https://dos.sunbiz.org/data-definitions/cor.html
 * Record length: 1440 characters. Positions below are 1-based (start, length).
 */
export const RECORD_LENGTH = 1440;

export const FIELDS = {
  corpNumber: [1, 12],
  corpName: [13, 192],
  status: [205, 1],           // A = active
  filingType: [206, 15],      // DOMP, DOMNP, FLAL (FL LLC), FORP, FORL, DOMLP...
  addr1: [221, 42],
  addr2: [263, 42],
  city: [305, 28],
  state: [333, 2],
  zip: [335, 10],
  country: [345, 2],
  mailAddr1: [347, 42],
  mailAddr2: [389, 42],
  mailCity: [431, 28],
  mailState: [459, 2],
  mailZip: [461, 10],
  mailCountry: [471, 2],
  fileDate: [473, 8],         // MMDDYYYY
  feiNumber: [481, 14],
  moreThanSixOfficers: [495, 1],
  lastTransDate: [496, 8],
  stateCountry: [504, 2],
  raName: [545, 42],
  raType: [587, 1],           // C = corporation, P = person
  raAddr: [588, 42],
  raCity: [630, 28],
  raState: [658, 2],
  raZip: [660, 9],
};

export const OFFICER_BLOCKS = Array.from({ length: 6 }, (_, i) => {
  const base = 669 + i * 128;
  return {
    title: [base, 4],
    type: [base + 4, 1],      // P = person, C = corporation
    name: [base + 5, 42],
    addr: [base + 47, 42],
    city: [base + 89, 28],
    state: [base + 117, 2],
    zip: [base + 119, 9],
  };
});

/** Extract a field from a fixed-width record line. */
export function field(line, [start, len]) {
  return line.slice(start - 1, start - 1 + len).trim();
}

/** Human-readable filing types (partial map; raw code kept as fallback). */
export const FILING_TYPE_LABELS = {
  FLAL: 'Florida LLC',
  DOMP: 'Florida Profit Corp',
  DOMNP: 'Florida Non-Profit Corp',
  DOMLP: 'Florida Limited Partnership',
  FORP: 'Foreign Profit Corp',
  FORNP: 'Foreign Non-Profit Corp',
  FORL: 'Foreign LLC',
  NONP: 'Non-Profit',
  TRUST: 'Trust',
};
