/**
 * The prototype register.
 *
 * One entry per design prototype under /lab. Adding a prototype means adding a
 * row here plus its route — the chooser reads this list, so nothing else needs
 * to know the set has grown.
 *
 * `status: "planned"` renders the card but not a link. A visible, unclickable
 * card is deliberate: the point of the chooser is to show what the lab is
 * exploring, and a prototype that has been agreed but not built is part of that.
 */

export type Prototype = {
  id: string;
  name: string;
  /** One line on what question the prototype is asking. */
  tagline: string;
  /** What is actually in it, for someone deciding whether to open it. */
  description: string;
  /** The route. Only followed when status is "ready". */
  href: string;
  status: "ready" | "planned";
  /** Named surfaces inside the prototype, shown as chips on the card. */
  covers: string[];
  /**
   * Whether the chooser leads with this one.
   *
   * Not a ranking of how good they are — a statement about which questions are still
   * open. An earlier prototype that has been superseded stays in the lab, because the
   * comparison is most of what the later one proves, but it should not be the first
   * thing on the page. The chooser puts these behind a disclosure.
   */
  archived?: boolean;
};

export const PROTOTYPES: Prototype[] = [
  {
    id: "generative-ui",
    name: "Adaptive UI",
    tagline: "A report that composes itself, in layers",
    description:
      "One question, and the page it needs is assembled from the answer: the planner decides what is being asked and whether the answer even needs a layout, the data is fetched by tool, the model says what the answer means and never names a component, and rules choose the recipe, the arrangement and the components. The page is validated before it is shown, and the written answer is always one click away.",
    href: "/lab/generative-ui",
    status: "ready",
    covers: ["Intent planning", "Semantic report", "Layout recipes", "Validated spec", "Graceful fallback"],
  },
  {
    id: "chat-transparency",
    name: "Chat transparency",
    tagline: "Showing the work behind an answer",
    description:
      "A simulated advisor conversation that exposes its own reasoning — the thought chain as it runs, how well the answer is grounded, and which client details were masked before the model saw them.",
    href: "/lab/thought-chain",
    status: "ready",
    covers: ["Thought chain", "Grounding marker", "Inspect response", "Masked PII"],
  },
  {
    id: "dynamic-ui",
    name: "Dynamic UI",
    tagline: "A report that assembles itself",
    description:
      "Ask for a portfolio analysis and the report is composed on the fly — the model reports what it found, and a deterministic layer decides which component shows it best. Then ask for a comparison chart and it's inserted into the existing report rather than regenerating it.",
    href: "/lab/dynamic-ui",
    status: "ready",
    covers: [
      "Runtime composition",
      "Component selection",
      "Progressive assembly",
      "Follow-up patches",
    ],
    /* The first attempt, and Adaptive UI is what it became: one model call returned a
       finished document, which left nowhere to put a rule and nothing to validate. Kept
       because that is a useful thing to be able to see, archived because it is not where
       the work is. */
    archived: true,
  },
];

/** The ones the chooser leads with, in order. */
export const CURRENT = PROTOTYPES.filter((prototype) => !prototype.archived);

/** The ones behind the disclosure. */
export const ARCHIVED = PROTOTYPES.filter((prototype) => prototype.archived);
