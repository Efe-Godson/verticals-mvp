export const CATEGORICAL_TYPES = [
  "dropdown",
  "multiplechoice",
  "checkbox",
];

export const NUMERIC_TYPES = [
  "number",
  "rating",
  "linearscale",
];

export function getFieldValues(submission, field) {
  const value = submission.data[field.id];

  if (field.type === "checkbox") {
    return Array.isArray(value) ? value : [];
  }

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return [];
  }

  return [value];
}

export function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// Compact number formatting for chart value labels - a full "4,036,000"
// doesn't fit above a narrow column on a phone.
//   'full' -> 4,036,000  (locale, no abbreviation)
//   'k'    -> 4,036K
//   'm'    -> 4.0M
//   'auto' -> K / M / B by magnitude, plain number below 10,000
export function compactNumber(value, mode = "auto") {
  const n = Number(value) || 0;
  if (mode === "full") return n.toLocaleString();
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const scaled = (divisor, decimals) =>
    `${sign}${(+(abs / divisor).toFixed(decimals)).toLocaleString()}`;
  if (mode === "k") return `${scaled(1e3, abs >= 1e5 ? 0 : 1)}K`;
  if (mode === "m") return `${scaled(1e6, 1)}M`;
  if (abs >= 1e9) return `${scaled(1e9, 1)}B`;
  if (abs >= 1e6) return `${scaled(1e6, 1)}M`;
  if (abs >= 1e4) return `${scaled(1e3, 0)}K`;
  return n.toLocaleString();
}

export function formatNaira(value, decimals = 0) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

// What to call one submission, everywhere a report or records view would
// otherwise say the generic (and often wrong-sounding) "response" - a cart
// field means "Order" reads better than "Response", and a template that
// tags its own settings.recordKind (Expenses sets 'expense', see
// src/locations.js) gets that instead of guessing. Falls back to
// "Response"/"Responses", the neutral, Google-Forms-standard term, for
// anything with no more specific identity (Data Collection, a Workflow
// example, a plain Forms template).
export function getEntryNoun(form, hasCartField) {
  if (hasCartField) return { singular: "Order", plural: "Orders" };
  const kind = form?.settings?.recordKind;
  if (kind) {
    const cap = kind.charAt(0).toUpperCase() + kind.slice(1);
    return { singular: cap, plural: `${cap}s` };
  }
  return { singular: "Response", plural: "Responses" };
}

export const thStyle = {
  textAlign: "left",
  padding: "0.5rem 0.7rem",
  background: "#fafafa",
  borderBottom: "1px solid #eee",
  position: "sticky",
  top: 0,
};

export const tdStyle = {
  padding: "0.5rem 0.7rem",
  borderBottom: "1px solid #f5f5f5",
};