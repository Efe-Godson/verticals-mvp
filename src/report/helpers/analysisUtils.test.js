import { describe, it, expect } from "vitest";
import { getFieldValues, median, formatNaira } from "./analysisUtils";

describe("getFieldValues", () => {
  it("returns checkbox array values as-is", () => {
    const submission = { data: { f1: ["a", "b"] } };
    expect(getFieldValues(submission, { id: "f1", type: "checkbox" })).toEqual(["a", "b"]);
  });

  it("returns empty array for missing checkbox value", () => {
    const submission = { data: {} };
    expect(getFieldValues(submission, { id: "f1", type: "checkbox" })).toEqual([]);
  });

  it("returns empty array for null/undefined/empty non-checkbox values", () => {
    const submission = { data: { f1: "" } };
    expect(getFieldValues(submission, { id: "f1", type: "text" })).toEqual([]);
  });

  it("wraps a plain value in an array", () => {
    const submission = { data: { f1: "hello" } };
    expect(getFieldValues(submission, { id: "f1", type: "text" })).toEqual(["hello"]);
  });
});

describe("median", () => {
  it("returns 0 for an empty array", () => {
    expect(median([])).toBe(0);
  });

  it("returns the middle value for odd-length arrays", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("averages the two middle values for even-length arrays", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("formatNaira", () => {
  it("formats a number as NGN currency", () => {
    expect(formatNaira(1000)).toBe("₦1,000");
  });

  it("falls back to 0 for non-numeric input", () => {
    expect(formatNaira(undefined)).toBe("₦0");
  });
});
