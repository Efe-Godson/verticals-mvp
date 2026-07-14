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