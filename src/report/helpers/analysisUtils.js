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

export function formatNaira(value, decimals = 0) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
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