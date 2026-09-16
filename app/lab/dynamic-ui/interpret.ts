/**
 * Layer 1 — read the ask, don't answer it.
 *
 * This is the interpretation layer: an arbitrary sentence in, a *shape of
 * question* out. It decides how many things are being compared, what dimension
 * they're being compared on, whether time is part of the question, and which
 * end of the ranking is wanted. It never decides what to draw — that's the
 * mapping layer in ./select.ts, which reads the finding's shape and picks a
 * renderer.
 *
 * The reason this file exists: "compare his top 4 holdings" and "compare his two
 * biggest" are the same question with a different number in it. Anything that
 * answers one by hardcoding a pair answers the other wrongly.
 */

import type { Emphasis } from "./findings";

export type RankKey = "value" | "return" | "cost";

export type Ask = {
  raw: string;
  /**
   * How many things to put side by side, when the ask says so. Undefined means
   * the ask didn't specify and the topic should choose a sensible width.
   */
  count?: number;
  /** What orders the list: size of position, performance, or money at risk. */
  rank: RankKey;
  /** What gets measured once they're side by side. */
  measure: RankKey;
  /** True when the question is about movement rather than a level. */
  overTime: boolean;
  /** Bottom of the ranking rather than the top. */
  worst: boolean;
  /** Restrict to individually listed names rather than pooled sleeves. */
  singleNames: boolean;
};

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  a: 1, an: 1, both: 2, couple: 2, few: 3, several: 4,
};

const NUM = `\\d{1,2}|${Object.keys(WORD_NUMBERS).join("|")}`;

const toNumber = (token: string): number | undefined => {
  const digits = Number.parseInt(token, 10);
  if (Number.isFinite(digits)) return digits;
  return WORD_NUMBERS[token.toLowerCase()];
};

/** Superlatives that imply a ranking, so a number next to them is a count. */
const RANK_WORDS =
  "top|biggest|largest|best|worst|smallest|weakest|strongest|leading|main|major|key|core|bottom|first";

const THINGS = "holding|holdings|position|positions|stock|stocks|name|names|sleeve|sleeves|line|lines";

/**
 * Pull a count out of the ask.
 *
 * Only counts that sit next to a superlative or a thing being counted — a bare
 * number is more often part of an instrument name ("SGS 10Y") or a horizon
 * ("last 3 months") than a request for three of something.
 */
function countIn(prompt: string): number | undefined {
  const patterns = [
    new RegExp(`\\b(?:${RANK_WORDS})\\s+(${NUM})\\b`, "i"),
    new RegExp(`\\b(${NUM})\\s+(?:${RANK_WORDS})\\b`, "i"),
    new RegExp(`\\b(${NUM})\\s+(?:${RANK_WORDS})?\\s*(?:${THINGS})\\b`, "i"),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(prompt);
    const parsed = match ? toNumber(match[1]) : undefined;
    if (parsed !== undefined && parsed >= 1) return Math.min(parsed, 12);
  }

  // "compare NVIDIA and Microsoft" — two named things is a count of two.
  if (/\b(?:vs\.?|versus|against)\b/i.test(prompt)) return 2;
  return undefined;
}

export function interpret(prompt: string): Ask {
  const p = ` ${prompt.toLowerCase()} `;
  const has = (pattern: RegExp) => pattern.test(p);

  const aboutReturn = has(/return|perform|gain|loss|growth|yield|up or down|winner|laggard|best|worst|strongest|weakest/);
  const aboutCost = has(/cost basis|unrealis|unrealiz|book value|entry price/);
  // Deliberately excludes "top" / "biggest" / "largest": those say how to *order*
  // the list, not what to measure once it's ordered. "Compare the top 4" is a
  // question about how they've done, not about how big they are.
  const aboutSize = has(/value|size|worth|weight|share|allocat|exposure|concentrat/);

  const rank: RankKey = aboutCost
    ? "cost"
    : has(/best|worst|strongest|weakest|winner|laggard|performer|performing/)
      ? "return"
      : aboutSize || has(/\b(?:top|biggest|largest|smallest)\b/)
        ? "value"
        : "return";

  const measure: RankKey = aboutCost ? "cost" : aboutSize && !aboutReturn ? "value" : "return";

  return {
    raw: prompt,
    count: countIn(prompt),
    rank,
    measure,
    overTime:
      measure === "return" ||
      has(/over time|history|historic|trend|track|trajector|since|ytd|month|year|moved|movement|chart/),
    worst: has(/worst|weakest|smallest|bottom|laggard|losing|lost|underperform/),
    /**
     * Pooled sleeves come out when the comparison is a performance one: a bond
     * ladder's return next to a single stock's is not a like-for-like line. When
     * the question is about size, the ladder is a legitimate row.
     */
    singleNames:
      has(/stock|equit|single|name|share price|listed|concentrat/) ||
      (!aboutCost && !(aboutSize && !aboutReturn)),
  };
}

/* ----------------------------------------------------------------- intent */

/**
 * What the ask *wants*, before anything is looked up.
 *
 *   answer — a fact with a one-sentence answer. "What's the client's name?"
 *            does not want twenty-two cards; building them is the failure the
 *            whole logic layer exists to avoid.
 *   report — enough to be worth assembling: an analysis, a comparison, a
 *            breakdown, a deep dive.
 *   amend  — a change to the report already on screen.
 *
 * The distinction is not "how long is the sentence" but "does the answer have a
 * shape": one number, one name, one date → a reply. Several things standing in
 * relation to each other → a report.
 */
export type Intent = "answer" | "report" | "amend";

/** Verbs and nouns that only make sense if something is going to be built. */
const BUILD_WORDS =
  /\b(report|analys|analyz|review|breakdown|break it down|dashboard|deep dive|chart|graph|plot|visuali[sz]|compare|comparison|table|summar|prepare|build|assemble|overview|snapshot of|show me the|walk me through|attribution|allocation)\b/i;

/** Instructions that only make sense against something already on screen. */
const AMEND_WORDS =
  /\b(add|remove|drop|instead|swap|replace|reorder|move|rearrange|restructure|change the|make (?:it|this|that)|also show|include|exclude|lead with|put .* (?:first|top|above|below))\b/i;

/**
 * Signals that the answer is a single fact: an interrogative about one attribute,
 * or an explicit request to keep it short.
 */
const LOOKUP_WORDS =
  /^\s*(?:who|what|what's|whats|when|when's|where|which|how much|how many|how old|is|are|was|does|do|did|has|have|can)\b/i;

/**
 * Interrogatives that ask for one attribute and nothing else, checked *before*
 * the build words.
 *
 * "When is the next review" contains the word "review", and reading that as a
 * request to build a review is the exact class of mistake this layer exists to
 * catch: a build word inside a question about a date is a noun, not a verb.
 */
const ATTRIBUTE_WORDS = /^\s*(?:who|whom|whose|when|when's|where)\b/i;

const SHORT_ANSWER_WORDS = /\b(just tell me|in a sentence|one line|no chart|don't build|dont build|quick(?:ly)?|briefly)\b/i;

export function intentOf(prompt: string, hasReport: boolean): Intent {
  const p = prompt.trim();

  if (SHORT_ANSWER_WORDS.test(p)) return "answer";
  if (ATTRIBUTE_WORDS.test(p) && p.split(/\s+/).length <= 12) return "answer";
  if (hasReport && AMEND_WORDS.test(p) && !BUILD_WORDS.test(p)) return "amend";
  if (BUILD_WORDS.test(p)) return "report";

  // An interrogative with no build word in it is a lookup. Length is a tiebreak,
  // not the rule: "what is his LTV" is a lookup, "what should he do about the
  // property purchase given rates, liquidity and the capital call" is not.
  if (LOOKUP_WORDS.test(p) && p.split(/\s+/).length <= 14) return "answer";

  return "report";
}

/* ------------------------------------------------- revising a single card */

/**
 * A visual the advisor named outright.
 *
 * The model is never allowed to name one — that rule is what keeps the mapping
 * layer in charge. A human pointing at a card and saying "make this a table" is
 * a different thing entirely: it's an override, and overrides win. Kept as a
 * *family* ("bars") rather than a renderer id, because which bar renderer fits
 * two entities versus eight is still the mapping layer's call.
 */
export type DrawRequest = "table" | "bars" | "lines" | "donut" | "text" | "checklist";

/**
 * What an advisor asked for while pointing at one card.
 *
 * Every field is optional and *only* set when the ask actually said so — unlike
 * `Ask`, which fills in defaults because it is answering a question from scratch.
 * A revision must leave everything it didn't mention alone: "show six" means six
 * of what's already there, not six of whatever the defaults would have picked.
 */
export type Revision = {
  raw: string;
  count?: number;
  measure?: RankKey;
  overTime?: boolean;
  worst?: boolean;
  singleNames?: boolean;
  emphasis?: Emphasis;
  /** Asked for the card to go away. */
  drop: boolean;
  draw?: DrawRequest;
  /** Nothing about the card's shape was stated — so it's a question, not an edit. */
  empty: boolean;
};

export function interpretRevision(prompt: string): Revision {
  const p = ` ${prompt.toLowerCase()} `;
  const has = (pattern: RegExp) => pattern.test(p);

  // "show 6", "just three" — a count with no superlative to hang off, which is
  // unambiguous here in a way it isn't in an open ask, because the thing being
  // counted is the card you're pointing at.
  const loose = new RegExp(`\\b(?:show|just|only|keep|give me|make it|include)\\s+(?:me\\s+)?(${NUM})\\b`, "i").exec(prompt);

  const measure: RankKey | undefined = has(/cost basis|unrealis|unrealiz|book value|entry price/)
    ? "cost"
    : has(/return|perform|gain|growth|yield/)
      ? "return"
      : has(/value|size|worth|weight|share of|allocat|exposure/)
        ? "value"
        : undefined;

  const wantsTime = has(/over time|history|historic|trend|track|trajector|since|month|movement|moved|how they have done/);
  const wantsLevels = has(/just the (?:numbers|levels|totals|values)|no history|without the history|current|today|snapshot|as of|drop the time|point in time/);

  const draw: DrawRequest | undefined = has(/checklist|check list|to-?dos?|tick ?box|action list/)
    ? "checklist"
    : has(/pie|donut|doughnut/)
    ? "donut"
    : has(/\btables?\b|rows|list of numbers|spreadsheet/)
      ? "table"
      : has(/\bbars?\b|bar chart|column chart/)
        ? "bars"
        : has(/\blines?\b|line chart|curve/)
          ? "lines"
          : has(/as (?:text|words|prose)|paragraph|bullets?|in words/)
            ? "text"
            : undefined;

  const emphasis: Emphasis | undefined = has(/headline|hero|bigger|larger|more prominent|promote|feature|lead with/)
    ? "primary"
    : has(/smaller|less prominent|demote|quieter|minor|footnote|supporting|de-emphasis|deemphasi/)
      ? "supporting"
      : undefined;

  const revision: Revision = {
    raw: prompt,
    count: countIn(prompt) ?? (loose ? toNumber(loose[1]) : undefined),
    measure,
    overTime: wantsTime ? true : wantsLevels ? false : undefined,
    worst: has(/worst|weakest|bottom|laggard|losing|underperform/)
      ? true
      : has(/best|strongest|top|biggest|largest|winner/)
        ? false
        : undefined,
    singleNames: has(/stock|equit|single name|listed|exclude the (?:bond|fund|ladder|sleeve)|drop the (?:bond|fund|ladder|sleeve)/)
      ? true
      : has(/include (?:the )?(?:bond|fund|ladder|sleeve)|all holdings|everything|whole book/)
        ? false
        : undefined,
    emphasis,
    drop: has(/remove|delete|drop this|drop it|get rid|take (?:this|it) out|hide this/),
    draw,
    empty: false,
  };

  revision.empty =
    revision.count === undefined &&
    revision.measure === undefined &&
    revision.overTime === undefined &&
    revision.worst === undefined &&
    revision.singleNames === undefined &&
    revision.emphasis === undefined &&
    revision.draw === undefined &&
    !revision.drop;

  return revision;
}

export default interpret;
