"use strict";

const { parseAcceptedBinomial } = require("../../scripts/backfill-species-taxa");
const { normalizedNameLevels } = require("../../scripts/relink-specimens-taxa");

describe("Step 1 - Taxa Backfill & Relink Logic", () => {
  describe("parseAcceptedBinomial", () => {
    test("accepts clean binomial", () => {
      const res = parseAcceptedBinomial("Supella longipalpa");
      expect(res.valid).toBe(true);
      expect(res.binomial).toBe("Supella longipalpa");
      expect(res.genusName).toBe("Supella");
      expect(res.epithet).toBe("longipalpa");
    });

    test("strips subgenus in parentheses and authorship/year", () => {
      const res = parseAcceptedBinomial("Supella (Supella) longipalpa (Fabricius, 1798)");
      expect(res.valid).toBe(true);
      expect(res.binomial).toBe("Supella longipalpa");
      expect(res.yearDescribed).toBe(1798);
      expect(res.authorship).toBe("(Fabricius, 1798)");
    });

    test("rejects open nomenclature (sp., cf., aff., indet.)", () => {
      expect(parseAcceptedBinomial("Papilio sp.").valid).toBe(false);
      expect(parseAcceptedBinomial("Papilio cf. demoleus").valid).toBe(false);
      expect(parseAcceptedBinomial("Papilio aff. polytes").valid).toBe(false);
      expect(parseAcceptedBinomial("Apis indet.").valid).toBe(false);
    });

    test("rejects hybrids, trinomial subspecies, and BOLD BINs", () => {
      expect(parseAcceptedBinomial("Papilio machaon × xuthus").valid).toBe(false);
      expect(parseAcceptedBinomial("Papilio x demoleus").valid).toBe(false);
      expect(parseAcceptedBinomial("Papilio polytes romulus").valid).toBe(false);
      expect(parseAcceptedBinomial("BOLD:AAD8883").valid).toBe(false);
    });
  });

  describe("normalizedNameLevels", () => {
    test("extracts canonical binomial and genus from subgenus + author string", () => {
      expect(normalizedNameLevels("Supella (Supella) longipalpa (Fabricius, 1798)")).toEqual([
        "supella longipalpa",
        "supella",
      ]);
    });

    test("ignores BOLD BINs and empty strings", () => {
      expect(normalizedNameLevels("BOLD:AAD8883")).toEqual([]);
      expect(normalizedNameLevels("")).toEqual([]);
      expect(normalizedNameLevels(null)).toEqual([]);
    });

    test("returns single word for Genus/Family", () => {
      expect(normalizedNameLevels("Pseudophyllodromiidae")).toEqual(["pseudophyllodromiidae"]);
    });
  });
});
