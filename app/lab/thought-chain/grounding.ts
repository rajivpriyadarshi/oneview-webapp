/**
 * Grounding — how well the answer is actually supported by client context.
 *
 * The thought chain shows what the AI *did*; this shows how much the answer it
 * produced can be relied on. Three states, scripted end to end so the lab can
 * flip between them from the control bar without touching the run:
 *
 *   well-grounded     strong consistent context, no known issues
 *   review-suggested  weak context, but a useful answer
 *   limited-basis     insufficient or conflicting context
 *
 * Deliberately orthogonal to ./scenarios: the same answer can be any of the
 * three, and the point of the prototype is to judge the marker, not the run.
 * Pure data — no API, no auth, same as the scenarios.
 */

export type GroundingLevel = "well-grounded" | "review-suggested" | "limited-basis";

export const GROUNDING_LEVELS: GroundingLevel[] = [
  "well-grounded",
  "review-suggested",
  "limited-basis",
];

/** Icons under /public/icons/grounding, exported from the Figma icon set. */
export type GroundingIcon =
  | "attachment"
  | "home"
  | "bar-chart"
  | "check"
  | "check-circle"
  | "alert-circle"
  | "alert-triangle"
  | "hourglass"
  | "shield-tick"
  | "cpu-chip"
  | "layers-three"
  | "chevron-down"
  | "close"
  | "link-external";

/**
 * One piece of client context the answer drew on.
 *
 * `source` and `detail` are split rather than pre-joined because both the hover
 * card and the panel name the same sources, and the two used to be written out
 * separately and drift apart — the hover card once claimed an "Insurance doc"
 * the panel had never heard of. The hover card is now derived from this list, so
 * they cannot disagree.
 */
export type ContextItem = {
  icon: GroundingIcon;
  title: string;
  /** The source itself, e.g. "Meeting notes". Repeats across items. */
  source: string;
  /** What qualifies it for this item — recency, confidence, conflict. */
  detail: string;
};

/**
 * One finding from the privacy pass. `warn` findings can carry a chip offering
 * the fix, which is the only action in the panel — everything else is read-only.
 */
export type SensitiveFinding = {
  tone: "ok" | "warn";
  /** How many identifiers this row accounts for. Drives the header count. */
  count: number;
  /** What kind of finding, and what to do about it. */
  note: string;
  action?: { label: string; verb: string };
};

/**
 * A span of the answer worth marking in place — currently only masked PII, shown
 * as a green underline under the word with the substitution on hover.
 *
 * `term` is matched literally against the rendered answer text, so it must
 * appear verbatim in the scenario's `answer` markdown or nothing underlines.
 */
export type AnswerAnnotation = {
  term: string;
  /** What the raw context said before the Privacy Guard pass. */
  detected: string;
  /** The placeholder the model actually received. */
  masked: string;
};

export type Grounding = {
  level: GroundingLevel;
  /** The pill under the answer. */
  label: string;
  /** Chip inside the inspect panel's banner. States the finding, not the level. */
  banner: string;
  /** The banner's one-line verdict. */
  verdict: string;
  context: ContextItem[];
  sensitive: SensitiveFinding[];
  /** Right-hand status on the "Policy" header. */
  policy: string;
  /** Why the policy check landed where it did. */
  policyNote: string;
};

/**
 * The distinct sources behind an answer, in first-seen order.
 *
 * Deduped on name: several findings can come off one set of meeting notes, and
 * counting that as three sources would overstate how corroborated the answer is
 * — which is the one thing this panel exists to be honest about.
 */
export function groundingSources(grounding: Grounding): string[] {
  const seen = new Map<string, string>();
  for (const item of grounding.context) {
    if (!seen.has(item.source)) seen.set(item.source, `${item.source} (${item.detail})`);
  }
  return [...seen.values()];
}

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

/** Header counts, derived so they can't contradict the rows beneath them. */
export const contextMeta = (grounding: Grounding) =>
  plural(groundingSources(grounding).length, "source");

export const sensitiveMeta = (grounding: Grounding) =>
  plural(
    grounding.sensitive.reduce((total, finding) => total + finding.count, 0),
    "identifier",
  );

/** Row title, derived from the same count the header adds up. */
export const sensitiveTitle = (finding: SensitiveFinding) =>
  `${plural(finding.count, "identifier")} ${finding.tone === "ok" ? "protected" : "need review"}`;

/**
 * The three states, each one internally consistent.
 *
 * They degrade along a single axis — how well the *context* supports the answer
 * — so the level always has one cause and every section tells that same story:
 *
 *   well-grounded     three sources, all current, corroborating each other
 *   review-suggested  the same claims, but resting on context nobody has
 *                     reconfirmed in five weeks
 *   limited-basis     one source, mentioned once, and two notes that disagree
 *
 * Every context item is a claim the answer actually makes, and the six protected
 * identifiers are the six the Privacy Guard step masks in ./scenarios — so the
 * panel can be checked against the trace above it rather than taken on faith.
 */
export const GROUNDINGS: Record<GroundingLevel, Grounding> = {
  "well-grounded": {
    level: "well-grounded",
    label: "Well grounded",
    banner: "No issues found",
    verdict: "This response is grounded in current client context, with nothing contradicting it",
    context: [
      { icon: "attachment", title: "$1M liquidity target", source: "Meeting notes", detail: "Aug 14" },
      { icon: "home", title: "Singapore property purchase", source: "Client profile", detail: "confirmed" },
      { icon: "bar-chart", title: "NASDAQ concentration at 52.4%", source: "Portfolio", detail: "live" },
      { icon: "bar-chart", title: "Prefers borrowing to selling", source: "Client profile", detail: "stated preference" },
    ],
    sensitive: [
      {
        tone: "ok",
        count: 6,
        note: "Names, accounts, and other sensitive details are masked",
      },
    ],
    policy: "Passed",
    policyNote:
      "Cleared disclosure, suitability and cross-border rules for this client's jurisdiction.",
  },

  "review-suggested": {
    level: "review-suggested",
    label: "Review suggested",
    banner: "Review needed",
    verdict: "This response is grounded but parts of it rest on context nobody has reconfirmed",
    context: [
      { icon: "attachment", title: "$1M liquidity target", source: "Meeting notes", detail: "5 weeks old" },
      { icon: "home", title: "Singapore property purchase", source: "Client profile", detail: "not reconfirmed" },
      { icon: "bar-chart", title: "NASDAQ concentration at 52.4%", source: "Portfolio", detail: "live" },
    ],
    sensitive: [
      {
        tone: "ok",
        count: 6,
        note: "Names, accounts, and other sensitive details are masked",
      },
      {
        tone: "warn",
        count: 1,
        note: "Entity · low confidence",
        action: { label: "Ranganathan Holdings Pte", verb: "Mask" },
      },
    ],
    policy: "Passed",
    policyNote:
      "Cleared disclosure, suitability and cross-border rules, but confirm the liquidity target before advising on it.",
  },

  "limited-basis": {
    level: "limited-basis",
    label: "Limited basis",
    banner: "Verify before acting",
    verdict: "This response rests on thin and partly conflicting context — verify the figures first",
    context: [
      { icon: "attachment", title: "$1M liquidity target", source: "Meeting notes", detail: "mentioned once" },
      { icon: "bar-chart", title: "Intent to trim NASDAQ", source: "Meeting notes", detail: "two notes disagree" },
    ],
    sensitive: [
      {
        tone: "ok",
        count: 6,
        note: "Names, accounts, and other sensitive details are masked",
      },
      {
        tone: "warn",
        count: 1,
        note: "Entity · low confidence",
        action: { label: "Ranganathan Holdings Pte", verb: "Mask" },
      },
    ],
    policy: "Review",
    policyNote:
      "Suitability cannot be established from one unconfirmed mention. Reconfirm with the client before acting on this.",
  },
};

/**
 * Per-level colour. Kept as one table rather than scattered conditionals so a
 * fourth state is a row here, not a hunt through the components.
 *
 * `icon` and `pillBg` come straight off the Figma tag components (3039:2260 /
 * 2492 / 2724), which share one shape — 12px glyph, 4px gap, 6/10 padding, a
 * 42px radius, and #111 at 80% for the label — and vary only in fill. The tag
 * is monochrome by design: the fill carries the state, so the glyph inherits
 * the label's colour instead of being tinted per level.
 *
 * `chipBg` is the saturated banner chip inside the inspect panel, which takes
 * black text at every level the way the design does.
 */
export const GROUNDING_TONE: Record<
  GroundingLevel,
  {
    icon: GroundingIcon;
    pillBg: string;
    pillFg: string;
    bannerBg: string;
    bannerBorder: string;
    chipBg: string;
  }
> = {
  "well-grounded": {
    icon: "check-circle",
    // Green rather than the Figma tag's neutral grey: against amber and red on
    // the other two levels, grey reads as "no state" instead of "the good one".
    // Reuses the Protected pill's green so the two safe signals match.
    pillBg: "#C9FAC5",
    pillFg: "#111111",
    bannerBg: "#F4FAF6",
    bannerBorder: "#E1EFE7",
    chipBg: "#8FE3B0",
  },
  "review-suggested": {
    icon: "hourglass",
    pillBg: "#FFF6D6",
    pillFg: "#111111",
    bannerBg: "#FAF7E7",
    bannerBorder: "#EAE8DF",
    chipBg: "#E9D00D",
  },
  "limited-basis": {
    icon: "alert-circle",
    pillBg: "#FFE5E5",
    pillFg: "#111111",
    bannerBg: "#FDF4F4",
    bannerBorder: "#F0E0E0",
    chipBg: "#F2A6A6",
  },
};
