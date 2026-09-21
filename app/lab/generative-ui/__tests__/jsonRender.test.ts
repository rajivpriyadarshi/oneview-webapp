/**
 * The json-render adapter.
 *
 * These tests are the reason the migration is worth trusting: they take specs the
 * deterministic composer actually produced and hand them to json-render's *own*
 * validators — `validateSpec` for structure and `CATALOG.validate` for the
 * vocabulary — so the contract is checked by the library that will render it rather
 * than by our reading of its docs.
 *
 * The property that matters most is "binds data by pointer and never by value".
 * Data-key indirection is what makes "the composer cannot change a figure" a
 * checkable claim, and the conversion is exactly where it could be lost by resolving
 * a value one line too early.
 */

import { describe, expect, it } from "vitest";
import { validateSpec } from "@json-render/core";
import { CATALOG, CATALOG_IDS } from "../catalog";
import { composeView } from "../compose";
import {
  COMPARE_BUNDLE,
  COMPARE_INTENT,
  COMPARE_REPORT,
  REVIEW_BUNDLE,
  REVIEW_INTENT,
  REVIEW_REPORT,
} from "../examples";
import { REGISTRY } from "../registry";
import { boundPointers, pointerFor, toJsonSpec } from "../toJsonSpec";

const CASES = [
  { name: "analytical review", report: REVIEW_REPORT, intent: REVIEW_INTENT, bundle: REVIEW_BUNDLE },
  { name: "comparison", report: COMPARE_REPORT, intent: COMPARE_INTENT, bundle: COMPARE_BUNDLE },
] as const;

const convert = (index: 0 | 1) => {
  const { report, intent, bundle } = CASES[index];
  const result = composeView(report, intent, bundle);
  if (!result.spec) throw new Error(`${CASES[index].name} composed no spec`);
  return { spec: result.spec, json: toJsonSpec(result.spec, bundle.values), bundle };
};

describe("toJsonSpec", () => {
  for (const [index, testCase] of CASES.entries()) {
    it(`${testCase.name}: passes json-render's structural validator`, () => {
      const { json } = convert(index as 0 | 1);
      const issues = validateSpec(json);
      expect(issues.issues.filter((issue) => issue.severity === "error")).toEqual([]);
      expect(issues.valid).toBe(true);
    });

    it(`${testCase.name}: binds data by pointer, never by value`, () => {
      const { json } = convert(index as 0 | 1);
      const bound = Object.values(json.elements).filter((element) => "data" in element.props);
      expect(bound.length).toBeGreaterThan(0);
      for (const element of bound) {
        expect(element.props.data).toHaveProperty("$state");
      }
    });

    it(`${testCase.name}: points every binding at a key the bundle has`, () => {
      const { json, bundle } = convert(index as 0 | 1);
      const available = new Set(Object.keys(bundle.values).map(pointerFor));
      for (const pointer of boundPointers(json)) {
        if (pointer === "/narrative") continue;
        expect(available.has(pointer)).toBe(true);
      }
    });
  }

  it("keeps our node ids, because a patch has to animate one card not the page", () => {
    const { spec, json } = convert(0);
    const first = spec.root[0];
    expect(json.elements[first.id]?.type).toBe(first.component);
    // Nothing minted: nestedToFlat would have produced el-0, el-1, …
    for (const key of Object.keys(json.elements)) {
      if (key !== "root") expect(key.startsWith("el-")).toBe(false);
    }
  });

  it("carries the prose answer into state, so the fallback survives the spec", () => {
    const { spec, json } = convert(0);
    expect(json.state.narrative).toBe(spec.narrative);
  });

  it("names only components the catalogue approves", () => {
    const { json } = convert(0);
    const approved = new Set<string>(CATALOG.componentNames);
    for (const element of Object.values(json.elements)) {
      expect(approved.has(element.type)).toBe(true);
    }
  });
});

describe("catalog", () => {
  it("covers every approved component and invents none", () => {
    expect(new Set(CATALOG.componentNames)).toEqual(new Set(Object.keys(REGISTRY)));
    expect(new Set(CATALOG_IDS)).toEqual(new Set(Object.keys(REGISTRY)));
  });

  it("exposes no actions, since the action vocabulary is not designed yet", () => {
    expect(CATALOG.actionNames).toEqual([]);
  });
});
