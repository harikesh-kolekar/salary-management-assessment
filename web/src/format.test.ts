import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate } from "./format";

describe("display formatting", () => {
  it("formats amounts in their own currency", () => {
    expect(formatCurrency(95000, "USD")).toContain("95,000");
    expect(formatCurrency(1450000, "INR")).toContain("14,50,000");
  });

  it("does not display missing salaries as zero", () => {
    expect(formatCurrency(null, "USD")).toBe("—");
  });

  it("formats date-only values without shifting timezone", () => {
    expect(formatDate("2025-01-01")).toContain("01 Jan 2025");
  });
});
