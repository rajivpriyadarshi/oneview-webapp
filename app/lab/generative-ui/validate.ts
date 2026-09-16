/**
 * Layer 8 — validation.
 *
 * Two kinds of check, in one pass, and the distinction between them is the whole
 * design of this file:
 *
 *   - **Structural.** Does the spec parse, does every component exist, are the props
 *     valid, is the nesting legal, is the tree within budget, is every binding real,
 *     and — the one that enforces §9 — is there a figure hiding in a prop. These are
 *     errors. A spec failing any of them cannot be rendered.
 *   - **Heuristic.** Eight KPI cards in a row, tabs with one item, a table for two
 *     records, twelve identical cards, the same fact in three places, a section
 *     created so a component could be used. These are the brief's UX rules, and they
 *     are what stops a technically-valid page from being a bad one.
 *
 * The contract around it is deliberately narrow and matches the brief exactly: run
 * the checks, attempt **one** repair pass, re-check, and if errors remain fall back
 * to the narrative. One pass, not a loop. A validator that keeps asking is a
 * validator that will eventually accept something bad because it ran out of
 * patience, and the fallback is always correct anyway.
 *
 * Repairs may only be `PresentationOp`s (./ops.ts), which is what makes "repair
 * cannot change the numbers" structural rather than careful.
 *
 * The old pipeline's equivalent was `critique.ts`: six rules over a finished
 * document, no notion of validity, no notion of failure. It could improve a page and
 * it could not reject one. Its six rules survive here and in the IA composer; what
 * changes is that this layer is allowed to say no.
 */

import { z } from "zod";
import { hasKey, type DataBundle } from "./data";
import type { PresentationOp } from "./ops";
import { REGISTRY, allowsChild, specOf, usesNamedSlots, type ComponentId } from "./registry";
import { UISpecSchema, childrenOf, walk, type UINode, type UISpec } from "./spec";

/* -------------------------------------------------------------------- limits
 *
 * Numbers, not vibes. Every one of them is a taste from the brief made
 * mechanical, and each is here so a reviewer can argue with the number rather than
 * with the behaviour.
 */
export const LIMITS = {
  /** Past six levels nobody can tell what contains what. */
  maxDepth: 6,
  /** A page, not a dashboard. Sixty nodes is already a long scroll. */
  maxNodes: 60,
  /** "Do not render eight KPI cards in one row." */
  maxMetricsPerRow: 4,
  minTabs: 2,
  maxTabs: 5,
  /** "Do not create a table for two simple records." */
  minTableRows: 3,
  /** "Do not create twelve visually identical cards." */
  maxIdenticalSiblings: 3,
  /** The same key rendered more times than this is the same fact said twice. */
  maxRepeatsOfOneKey: 2,
  maxHeroNodes: 1,
} as const;

/* -------------------------------------------------------------------- issues */

export const IssueCodeSchema = z.enum([
  // structural
  "schema_invalid",
  "unknown_component",
  "invalid_props",
  "unknown_prop",
  "illegal_nesting",
  "wrong_slot_shape",
  "depth_exceeded",
  "node_budget_exceeded",
  "child_count_out_of_range",
  "duplicate_node_id",
  "missing_data_binding",
  "unknown_data_key",
  /** A figure in a prop. The §9 violation, caught mechanically. */
  "literal_in_props",
  // heuristic
  "too_many_metrics_in_row",
  "degenerate_tabs",
  "table_too_small",
  "identical_siblings",
  "duplicate_content",
  "empty_container",
  "no_headline",
  "competing_headlines",
  "missing_page_header",
]);
export type IssueCode = z.infer<typeof IssueCodeSchema>;

export type ValidationIssue = {
  code: IssueCode;
  severity: "error" | "warning";
  /** Node the issue attaches to, when it attaches to one. */
  nodeId?: string;
  /** What is wrong, in a sentence a reviewer can act on. */
  message: string;
  /** A presentation-only fix, when there is an obvious one. */
  repair?: PresentationOp;
};

export type ValidationResult = {
  /** No errors. Warnings do not block rendering. */
  ok: boolean;
  issues: ValidationIssue[];
  /** Repairs worth attempting, in the order they should be applied. */
  repairs: PresentationOp[];
};

/* ------------------------------------------------------------------ helpers */

/**
 * Does this string contain a figure?
 *
 * Currency with digits, a percentage, a decimal, or a thousands-grouped number.
 * Deliberately not "contains a digit": "Q3 2025", "1M return" and "Top 10 holdings"
 * are labels, and rejecting them would make the rule so annoying that the next
 * person would delete it. This catches restated *values*, which is what §9 is about.
 */
export const FIGURE = /(?:[$€£¥₣]\s?\d|\d\s?(?:%|bps)\b|\b\d[\d,]*\.\d|\b\d{1,3}(?:,\d{3})+\b)/;

const figuresIn = (value: unknown): boolean => {
  if (typeof value === "string") return FIGURE.test(value);
  if (Array.isArray(value)) return value.some(figuresIn);
  if (value !== null && typeof value === "object") return Object.values(value).some(figuresIn);
  return false;
};

/** A node's shape signature, for spotting siblings that are the same thing twice. */
const signatureOf = (node: UINode): string =>
  `${node.component}:${node.props.variant ?? ""}:${node.props.size ?? ""}`;

const rowLike = (component: ComponentId): boolean =>
  component === "Grid" || component === "MetricStrip" || component === "Stack";

/** Length of a bound collection, when the binding resolves to one. */
function boundLength(bundle: DataBundle, key: string | undefined): number | null {
  if (!key) return null;
  const value = bundle.values[key];
  if (Array.isArray(value)) return value.length;
  return null;
}

/* --------------------------------------------------------------- structural */

function checkNode(
  node: UINode,
  parent: UINode | null,
  depth: number,
  bundle: DataBundle,
  seenIds: Set<string>,
  issues: ValidationIssue[],
): void {
  if (!(node.component in REGISTRY)) {
    issues.push({
      code: "unknown_component",
      severity: "error",
      nodeId: node.id,
      message: `"${node.component}" is not in the approved registry.`,
    });
    return;
  }
  const spec = specOf(node.component);

  if (seenIds.has(node.id)) {
    issues.push({
      code: "duplicate_node_id",
      severity: "error",
      nodeId: node.id,
      // Duplicate ids break the patch reducer and the reveal animation before they
      // break anything visible, which is why this is an error rather than a warning.
      message: `Node id "${node.id}" is used more than once.`,
    });
  }
  seenIds.add(node.id);

  if (depth > LIMITS.maxDepth) {
    issues.push({
      code: "depth_exceeded",
      severity: "error",
      nodeId: node.id,
      message: `Nested ${depth} deep; the limit is ${LIMITS.maxDepth}.`,
    });
  }

  /*
   * `variant` and `size` are universal props, checked against the registry's
   * declared lists rather than restated in every component's schema. Declaring them
   * once is the difference between a registry a person will keep accurate and
   * twenty-eight copies of the same two enums.
   */
  const { variant, size, ...rest } = node.props;
  if (variant !== undefined && !spec.variants.includes(String(variant))) {
    issues.push({
      code: "invalid_props",
      severity: "error",
      nodeId: node.id,
      message: `${node.component} has no variant "${String(variant)}" (${spec.variants.join(", ") || "none declared"}).`,
    });
  }
  if (size !== undefined && !spec.sizes.includes(size as "sm" | "md" | "lg")) {
    issues.push({
      code: "invalid_props",
      severity: "error",
      nodeId: node.id,
      message: `${node.component} does not come in size "${String(size)}" (${spec.sizes.join(", ")}).`,
    });
  }

  const parsed = spec.propsSchema.safeParse(rest);
  if (!parsed.success) {
    issues.push({
      code: "invalid_props",
      severity: "error",
      nodeId: node.id,
      message: `${node.component} props invalid: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"} ${issue.message}`)
        .join("; ")}`,
    });
  } else {
    // Zod strips what it doesn't know, so the difference is the unknown props. A
    // prop the component will silently ignore is a composer that thinks it said
    // something it did not.
    const kept = new Set(Object.keys(parsed.data as Record<string, unknown>));
    const unknown = Object.keys(rest).filter((key) => !kept.has(key));
    if (unknown.length > 0) {
      issues.push({
        code: "unknown_prop",
        severity: "error",
        nodeId: node.id,
        message: `${node.component} has no prop ${unknown.map((key) => `"${key}"`).join(", ")}.`,
      });
    }
  }

  const leaking = Object.entries(node.props).filter(([, value]) => figuresIn(value));
  if (leaking.length > 0) {
    issues.push({
      code: "literal_in_props",
      severity: "error",
      nodeId: node.id,
      message: `Figures in props (${leaking
        .map(([key]) => key)
        .join(", ")}). Values come from the data bundle by key, never from the composer.`,
    });
  }

  const keys = [...(node.dataKey ? [node.dataKey] : []), ...(node.dataKeys ?? [])];
  if (spec.requiresData && keys.length === 0) {
    issues.push({
      code: "missing_data_binding",
      severity: "error",
      nodeId: node.id,
      message: `${node.component} needs a data binding and has none.`,
    });
  }
  for (const key of keys) {
    if (hasKey(bundle, key)) continue;
    issues.push({
      code: "unknown_data_key",
      severity: "error",
      nodeId: node.id,
      // A key that did not arrive is the most likely cause of an empty-looking area,
      // and the failure the old pipeline had no way to name.
      message: `"${key}" is not in the data bundle, or resolved to nothing.`,
    });
  }

  if (parent && !allowsChild(parent.component, node.component)) {
    issues.push({
      code: "illegal_nesting",
      severity: "error",
      nodeId: node.id,
      message: `${node.component} may not sit inside ${parent.component}.`,
    });
  }

  const kids = childrenOf(node);
  if (spec.children.allowed === "none" && kids.length > 0) {
    issues.push({
      code: "illegal_nesting",
      severity: "error",
      nodeId: node.id,
      message: `${node.component} takes no children.`,
    });
    return;
  }

  const needsNamed = usesNamedSlots(node.component);
  const named = Object.keys(node.slots ?? {});
  if (needsNamed && named.length === 0) {
    issues.push({
      code: "wrong_slot_shape",
      severity: "error",
      nodeId: node.id,
      message: `${node.component} takes named regions, not a flat child list.`,
    });
  }
  if (!needsNamed && named.length > 0) {
    issues.push({
      code: "wrong_slot_shape",
      severity: "error",
      nodeId: node.id,
      message: `${node.component} takes a flat child list, not named regions.`,
    });
  }

  const count = needsNamed ? named.length : kids.length;
  const { min, max } = spec.children;
  if (min !== undefined && count < min) {
    issues.push({
      code: count === 0 ? "empty_container" : "child_count_out_of_range",
      severity: "error",
      nodeId: node.id,
      message: `${node.component} needs at least ${min} ${needsNamed ? "regions" : "children"}; it has ${count}.`,
    });
  }
  if (max !== undefined && count > max) {
    issues.push({
      code: "child_count_out_of_range",
      severity: "error",
      nodeId: node.id,
      message: `${node.component} takes at most ${max} ${needsNamed ? "regions" : "children"}; it has ${count}.`,
    });
  }
}

/* ---------------------------------------------------------------- heuristics */

function checkHeuristics(spec: UISpec, bundle: DataBundle, issues: ValidationIssue[]): void {
  const nodes = [...walk(spec)];

  /* One page header, first. */
  const headers = nodes.filter((entry) => entry.node.component === "PageHeader");
  if (headers.length !== 1 || spec.root[0]?.component !== "PageHeader") {
    issues.push({
      code: "missing_page_header",
      severity: headers.length > 1 ? "error" : "warning",
      message:
        headers.length > 1
          ? `${headers.length} PageHeaders; a view has one.`
          : "The view does not open with a PageHeader.",
    });
  }

  /* Exactly one thing carries the headline. */
  const heroes = nodes.filter((entry) => entry.node.props.variant === "hero");
  if (heroes.length > LIMITS.maxHeroNodes) {
    issues.push({
      code: "competing_headlines",
      severity: "warning",
      nodeId: heroes[1].node.id,
      // `critique.ts` rules 2 and 3, kept: a page where everything is the same
      // weight has no entry point, and a page with three entry points has none either.
      message: `${heroes.length} elements claim hero emphasis; only the headline should.`,
      repair: {
        op: "setEmphasis",
        areaId: heroes[1].node.sectionId ?? heroes[1].node.id,
        sectionId: heroes[1].node.sectionId ?? heroes[1].node.id,
        emphasis: "normal",
      },
    });
  } else if (heroes.length === 0 && nodes.length > 6) {
    issues.push({
      code: "no_headline",
      severity: "warning",
      message: "Nothing on the page is the headline.",
    });
  }

  for (const { node } of nodes) {
    const kids = childrenOf(node);

    /* Eight KPI cards in a row. */
    if (rowLike(node.component)) {
      const metrics = kids.filter(
        (kid) => kid.component === "Metric" || kid.component === "HoldingCard",
      );
      if (metrics.length > LIMITS.maxMetricsPerRow) {
        issues.push({
          code: "too_many_metrics_in_row",
          severity: "error",
          nodeId: node.id,
          message: `${metrics.length} figures side by side; ${LIMITS.maxMetricsPerRow} is the most a reader takes in. Use a table.`,
          repair: { op: "setComponent", nodeId: node.id, component: "DataTable" },
        });
      }

      /* Twelve visually identical cards. */
      const bySignature = new Map<string, UINode[]>();
      for (const kid of kids) {
        const key = signatureOf(kid);
        bySignature.set(key, [...(bySignature.get(key) ?? []), kid]);
      }
      for (const [, group] of bySignature) {
        if (group.length <= LIMITS.maxIdenticalSiblings) continue;
        issues.push({
          code: "identical_siblings",
          severity: "error",
          nodeId: node.id,
          message: `${group.length} identical ${group[0].component}s in one container. Repeated records with the same attributes are a table.`,
          repair: { op: "setComponent", nodeId: node.id, component: "DataTable" },
        });
      }
    }

    /* Tabs with one item, or with nine. */
    if (node.component === "Tabs") {
      const regions = Object.keys(node.slots ?? {}).length;
      if (regions < LIMITS.minTabs || regions > LIMITS.maxTabs) {
        issues.push({
          code: "degenerate_tabs",
          severity: "error",
          nodeId: node.id,
          message: `${regions} tab${regions === 1 ? "" : "s"}; tabs are for ${LIMITS.minTabs}–${LIMITS.maxTabs} sibling views.`,
        });
      }
    }

    /*
     * The same rule again for the case where the row's contents arrive by binding
     * rather than as children. A MetricStrip over nine figures is the eight-KPI wall
     * with one node instead of eight, and checking only the child list would miss
     * the shape the rule exists to prevent.
     */
    if (node.component === "MetricStrip") {
      const figures = boundLength(bundle, node.dataKey);
      if (figures !== null && figures > LIMITS.maxMetricsPerRow) {
        issues.push({
          code: "too_many_metrics_in_row",
          severity: "error",
          nodeId: node.id,
          message: `A metric strip over ${figures} figures; ${LIMITS.maxMetricsPerRow} is the most a reader takes in at once.`,
          repair: { op: "setComponent", nodeId: node.id, component: "DataTable" },
        });
      }
    }

    /* A table for two records. */
    if (node.component === "DataTable") {
      const rows = boundLength(bundle, node.dataKey);
      if (rows !== null && rows < LIMITS.minTableRows) {
        issues.push({
          code: "table_too_small",
          severity: "warning",
          nodeId: node.id,
          message: `A table over ${rows} record${rows === 1 ? "" : "s"}. Below ${LIMITS.minTableRows}, say it directly.`,
          repair: { op: "setComponent", nodeId: node.id, component: "Comparison" },
        });
      }
    }
  }

  /*
   * The same fact in three places on the page.
   *
   * Counted by *place*, not by node, and the distinction is load-bearing. Four Metric
   * cards in one Grid all bind the key they were fanned out from and each draws a
   * different figure from it — that is one place, and counting nodes made the rule fire
   * on the most ordinary layout in the system. So siblings of the same component under
   * one parent collapse to one place; anything else counts. Two places is legitimate: a
   * figure in the headline and again in the chart beneath it. Three is padding.
   *
   * A source list is exempt. Restating every key the page used is not repetition, it
   * is the provenance section doing its one job.
   */
  const perKey = new Map<string, Map<string, UINode>>();
  for (const { node, parent } of nodes) {
    if (node.component === "SourceList") continue;
    for (const key of [...(node.dataKey ? [node.dataKey] : []), ...(node.dataKeys ?? [])]) {
      const places = perKey.get(key) ?? new Map<string, UINode>();
      places.set(`${parent?.id ?? "(root)"}:${node.component}`, node);
      perKey.set(key, places);
    }
  }
  for (const [key, places] of perKey) {
    if (places.size <= LIMITS.maxRepeatsOfOneKey) continue;
    const last = [...places.values()][places.size - 1];
    issues.push({
      code: "duplicate_content",
      severity: "warning",
      nodeId: last.id,
      message: `"${key}" is rendered in ${places.size} separate places.`,
    });
  }
}

/* ------------------------------------------------------------------- entry */

export function validate(spec: unknown, bundle: DataBundle): ValidationResult {
  const parsed = UISpecSchema.safeParse(spec);
  if (!parsed.success) {
    return {
      ok: false,
      repairs: [],
      issues: [
        {
          code: "schema_invalid",
          severity: "error",
          message: parsed.error.issues
            .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
            .join("; "),
        },
      ],
    };
  }

  const valid = parsed.data;
  const issues: ValidationIssue[] = [];

  const count = [...walk(valid)].length;
  if (count > LIMITS.maxNodes) {
    issues.push({
      code: "node_budget_exceeded",
      severity: "error",
      message: `${count} components; the page budget is ${LIMITS.maxNodes}.`,
    });
  }

  const seenIds = new Set<string>();
  for (const { node, parent, depth } of walk(valid)) {
    checkNode(node, parent, depth, bundle, seenIds, issues);
  }
  checkHeuristics(valid, bundle, issues);

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    issues,
    repairs: issues.flatMap((issue) => (issue.repair ? [issue.repair] : [])),
  };
}

/**
 * What the caller should do with a result.
 *
 * Stated as a function so that every caller — the route, the shell, the tests —
 * agrees on the fallback contract instead of each re-deriving it. `"repair"` is
 * offered at most once per view; the caller is responsible for not looping, and
 * `attempted` is how it says so.
 */
export const outcomeOf = (
  result: ValidationResult,
  attempted: boolean,
): "render" | "repair" | "fallback" => {
  if (result.ok) return "render";
  if (!attempted && result.repairs.length > 0) return "repair";
  return "fallback";
};
