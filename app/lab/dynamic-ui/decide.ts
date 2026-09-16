/**
 * The decider. Reads the *answer*, not the question.
 *
 * Everything upstream of this file guesses from the ask: `intentOf` looks at what
 * was typed and decides whether it smells like a lookup or an analysis. That is a
 * guess made before anyone knows what the answer contains, and it is wrong in
 * both directions — "how is he doing?" is four words and wants a page, while
 * "give me a full breakdown of his relationship manager" wants a name.
 *
 * So the real decision happens here, after the model has already answered in
 * prose. The prose is evidence: how many figures it cites, whether it lists
 * things, whether it puts two things side by side, whether it ends with steps
 * someone has to take. A paragraph with one number in it is a reply. Four
 * hundred words citing eleven figures across five subjects is a report that
 * happens to have been written as prose, and the job is to notice that and say
 * what shape it should be.
 *
 * The second half of the job is the *categories*: not "this is a report" but
 * "this answer contains a to-do list, a comparison and an allocation". Those
 * names are what the structuring stage is told to look for, and they are why a
 * to-do ends up as tick boxes rather than another paragraph — the category is
 * decided from the language before anything is drawn.
 *
 * Every decision carries a `because` in the advisor's words, because all of this
 * happens while the report pane is still blank and that is what fills it.
 */

import { intentOf } from "./interpret";
import type { FindingKind } from "./findings";

/** A section the answer earns, and the kind of finding that section is made of. */
export type CategoryId =
  | "todo"
  | "steps"
  | "recommendation"
  | "comparison"
  | "prosCons"
  | "allocation"
  | "movement"
  | "timeline"
  | "risk"
  | "requirement"
  | "figures"
  | "insights"
  | "narrative";

export type Category = {
  id: CategoryId;
  /** Section heading, as the reader will see it. */
  label: string;
  /** The finding kind the structuring stage should produce for this section. */
  produces: FindingKind;
  /** What in the answer earned it. Shown in the thinking panel. */
  because: string;
};

export type Decision = {
  wants: "reply" | "report";
  because: string;
  categories: Category[];
  /** The counts the decision was made on, so the panel can show its working. */
  evidence: { figures: number; percentages: number; listItems: number; subjects: number };
};

type Signal = {
  id: CategoryId;
  label: string;
  produces: FindingKind;
  /** What the answer has to contain. */
  test: RegExp;
  because: string;
};

/**
 * Ordered by how much a section of this kind wants to be near the top. A page
 * that opens with what's outstanding and closes with the narrative reads better
 * than the reverse, and this ordering is the only place that preference lives.
 */
const SIGNALS: Signal[] = [
  {
    id: "risk",
    label: "What needs watching",
    produces: "flag",
    test: /\b(risk|risks|breach|breaches|exceeds?|exceeded|above (?:the )?(?:policy|guideline|limit)|concentrat\w+|unhedged|overweight|too much|vulnerab\w+)\b/i,
    because: "it names something outside where it should be",
  },
  {
    id: "requirement",
    label: "What's committed",
    produces: "requirement",
    test: /\b(by (?:next|end of|Q[1-4]|\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))|deadline|due|matures?|maturity|capital call|commitment|needs? (?:to be )?(?:funded|available|in place))\b/i,
    because: "it ties an amount to a date",
  },
  {
    id: "recommendation",
    label: "What to do about it",
    produces: "recommendation",
    test: /\b(recommend\w*|i'd suggest|suggest\w*|the best (?:option|route|course)|worth (?:doing|considering)|makes sense to|advise|my view)\b/i,
    because: "it argues for a course of action",
  },
  {
    id: "todo",
    label: "What's outstanding",
    produces: "checklist",
    test: /\b(should|needs? to|ought to|next steps?|action items?|to-?do|outstanding|follow up|follow-up|confirm|chase|decide|agree|review before|before the (?:next )?(?:review|meeting))\b/i,
    because: "it ends with things somebody has to do",
  },
  {
    // Ordered work, not a bag of tasks. Same tick boxes; the difference is that the
    // order is load-bearing, and the structuring stage is told to keep it.
    id: "steps",
    label: "In what order",
    produces: "checklist",
    test: /\b(first(?:ly)?,|then|after that|step \d|stage \d|begin by|start by|once (?:that|this) is|finally,|sequence)\b/i,
    because: "it describes a sequence that has to happen in order",
  },
  {
    id: "comparison",
    label: "Side by side",
    produces: "comparison",
    test: /\b(vs\.?|versus|against|compared? (?:to|with)|relative to|ahead of|behind|outperform\w*|underperform\w*|larger than|bigger than|top \w+ (?:holdings?|positions?|names?))\b/i,
    because: "it puts things next to each other",
  },
  {
    id: "prosCons",
    label: "What's for and against",
    produces: "comparison",
    test: /\b(pros? and cons?|upside\w*|downside\w*|on the (?:other|one) hand|advantage\w*|drawback\w*|trade-?offs?|the case (?:for|against)|but it (?:does|would|means))\b/i,
    because: "it weighs options against each other rather than ranking them",
  },
  {
    id: "allocation",
    label: "How it's split",
    produces: "composition",
    test: /\b(\d+(?:\.\d+)?%\s+(?:of|in)|allocation|allocated|weight\w*|split|mix|breakdown|made up of|share of (?:the )?portfolio|sits in)\b/i,
    because: "it describes parts of one whole",
  },
  {
    id: "movement",
    label: "What moved",
    produces: "trend",
    test: /\b(from [^.]{1,30}\bto\b|rose|fell|grew|declined|up (?:from|by)|down (?:from|by)|since|year to date|ytd|over the (?:past|last)|trend\w*|moved)\b/i,
    because: "it describes a change over time",
  },
  {
    // Dated events rather than a measured series. It produces transitions because
    // "X happens in March, Y in June" is a sequence of states, not a line — and a
    // line drawn through three dates with no values on them is a lie.
    id: "timeline",
    label: "When things happen",
    produces: "transition",
    test: /\b(next month|next quarter|in (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*|by (?:mid|early|late)|within (?:six|three|twelve|\d+) (?:weeks|months)|over the next|timeline|schedule[ds]?)\b/i,
    because: "it places events on a calendar",
  },
  {
    id: "figures",
    label: "The numbers",
    produces: "metric",
    test: /(?:S\$|US\$|\$|€|£)\s?\d|(?:\b\d[\d,.]*\s?(?:m|bn|k|million|billion)\b)/i,
    because: "it cites figures that deserve to be read at a glance",
  },
  {
    id: "insights",
    label: "What stands out",
    produces: "narrative",
    test: /\b(the (?:key|main) (?:point|thing|issue|risk)|worth noting|notably|the real (?:question|problem)|in short|bottom line|what this means)\b/i,
    because: "it draws a conclusion rather than reporting a number",
  },
];

const countMatches = (text: string, pattern: RegExp): number =>
  (text.match(new RegExp(pattern.source, "gi")) ?? []).length;

/** Lines that are visibly a list, however the model chose to mark them. */
const listItemsIn = (text: string): number =>
  text
    .split("\n")
    .filter((line) => /^\s*(?:[-*•–]|\d+[.)])\s+\S/.test(line)).length;

/**
 * Roughly how many distinct things the answer is about. A crude proxy —
 * paragraphs and list groups — but the distinction it draws is the one that
 * matters: one subject stated well is a reply, five subjects is a page.
 */
const subjectsIn = (text: string): number => {
  const paragraphs = text.split(/\n\s*\n/).filter((part) => part.trim().length > 40).length;
  return Math.max(paragraphs, listItemsIn(text) > 2 ? 2 : 1);
};

export function decide(prompt: string, answer: string): Decision {
  const text = answer.trim();
  const figures = countMatches(text, /(?:S\$|US\$|\$|€|£)\s?\d[\d,.]*|(?:\b\d[\d,.]*\s?(?:m|bn|k)\b)/);
  const percentages = countMatches(text, /\b\d+(?:\.\d+)?%/);
  const listItems = listItemsIn(text);
  const subjects = subjectsIn(text);
  const evidence = { figures, percentages, listItems, subjects };

  const matched = SIGNALS.filter((signal) => signal.test.test(text))
    // "Do these three things" and "do them in this order" are the same section;
    // asking for both produces two checklists of the same items, and the ordered
    // reading is the stronger claim.
    .filter((signal, _i, all) => !(signal.id === "todo" && all.some((other) => other.id === "steps")))
    // A page with nine sections is a page with no shape. Six is already more than
    // most answers earn, and the ordering above means what gets cut is what wanted
    // to be near the bottom anyway.
    .slice(0, 6);

  const categories: Category[] = matched.map(({ id, label, produces, because }) => ({
    id, label, produces, because,
  }));

  /* The ask gets a veto, not a vote. Someone who asked a one-attribute question
     is owed a sentence even if the answer came back chatty — building a page on
     top of "who is his RM?" is the failure this whole layer exists to prevent.
     But it only holds while the answer agrees: an answer stacked with figures is
     evidence the question was bigger than it read. */
  const asked = intentOf(prompt, false);
  if (asked === "answer" && figures + percentages < 4 && listItems < 3) {
    return {
      wants: "reply",
      because: "The question asked for one thing and the answer gave one thing, so there's nothing to lay out.",
      categories: [],
      evidence,
    };
  }

  /* Short and thin. Not a length rule dressed up — a page needs something to put
     in more than one place, and this is the test for whether there is one. */
  const weight = figures + percentages + listItems;
  if (weight < 3 && subjects < 2) {
    return {
      wants: "reply",
      because: `The answer holds ${weight === 0 ? "no figures" : `only ${weight} figure${weight === 1 ? "" : "s"}`} and covers one subject — it reads better as a sentence than as cards.`,
      categories: [],
      evidence,
    };
  }

  // Something to lay out, but nothing the signals recognise. Still a page: the
  // alternative is dropping evidence on the floor because it didn't match a
  // regex, and prose sections are a legitimate outcome.
  const withFallback: Category[] =
    categories.length > 0
      ? categories
      : [{
          id: "narrative",
          label: "In summary",
          produces: "narrative",
          because: "it has substance but no shape a chart would improve",
        }];

  return {
    wants: "report",
    because: `${figures + percentages} figure${figures + percentages === 1 ? "" : "s"} across ${subjects} subject${subjects === 1 ? "" : "s"} — enough standing in relation to each other to be worth laying out.`,
    categories: withFallback,
    evidence,
  };
}

export default decide;
