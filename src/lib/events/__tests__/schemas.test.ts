import { describe, it, expect } from "vitest";
import {
  CreateEventSchema,
  EventFieldsSchema,
  PackagesArraySchema,
  rupeesToPaise,
} from "../schemas";
import { validateAuthorityLetterFile } from "../letter";

describe("rupeesToPaise", () => {
  it("converts whole rupees", () => {
    expect(rupeesToPaise("100")).toBe(10000);
    expect(rupeesToPaise(250)).toBe(25000);
  });

  it("accepts Indian grouping commas", () => {
    expect(rupeesToPaise("1,000")).toBe(100000);
  });

  it("rejects negatives", () => {
    expect(rupeesToPaise("-1")).toBeNull();
  });
});

describe("EventFieldsSchema", () => {
  const base = {
    title: "Navratri Night",
    description: "Garba",
    event_type_id: 1,
    city_id: 2,
    venue: "GMDC",
    season: "navratri-2027",
    start_date: "2027-10-01",
    end_date: "2027-10-10",
    expected_audience: 5000,
    audience_notes: null,
    visibility: "public" as const,
  };

  it("accepts valid fields", () => {
    expect(EventFieldsSchema.safeParse(base).success).toBe(true);
  });

  it("rejects end before start (FR-EVT-07)", () => {
    const result = EventFieldsSchema.safeParse({
      ...base,
      end_date: "2027-09-01",
    });
    expect(result.success).toBe(false);
  });
});

describe("PackagesArraySchema", () => {
  it("requires at least one package", () => {
    expect(PackagesArraySchema.safeParse([]).success).toBe(false);
  });

  it("rejects negative price", () => {
    expect(
      PackagesArraySchema.safeParse([
        { name: "Gold", price_paise: -1, deliverables: null, slots_total: null },
      ]).success,
    ).toBe(false);
  });

  it("accepts zero price", () => {
    expect(
      PackagesArraySchema.safeParse([
        { name: "Title", price_paise: 0, deliverables: "Logo", slots_total: 1 },
      ]).success,
    ).toBe(true);
  });
});

describe("CreateEventSchema", () => {
  it("requires packages with event fields", () => {
    const result = CreateEventSchema.safeParse({
      title: "E",
      event_type_id: 1,
      city_id: 1,
      start_date: "2027-10-01",
      end_date: "2027-10-02",
      visibility: "private",
      packages: [{ name: "Silver", price_paise: 50000 }],
    });
    expect(result.success).toBe(true);
  });
});

describe("validateAuthorityLetterFile", () => {
  it("allows missing upload", () => {
    const r = validateAuthorityLetterFile(null);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.file).toBeNull();
  });

  it("rejects non-pdf", () => {
    const file = new File(["x"], "note.txt", { type: "text/plain" });
    const r = validateAuthorityLetterFile(file);
    expect(r.ok).toBe(false);
  });

  it("accepts pdf under 5 MB", () => {
    const file = new File(["%PDF"], "letter.pdf", { type: "application/pdf" });
    const r = validateAuthorityLetterFile(file);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.file).toBeTruthy();
  });
});
