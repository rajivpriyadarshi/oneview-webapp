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
};

export const PROTOTYPES: Prototype[] = [
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
  },
  {
    id: "generative-ui",
    name: "Generative UI",
    tagline: "The same idea, rebuilt as a pipeline",
    description:
      "Dynamic UI asked one model for a finished report. This one splits the job into layers: the planner decides what is being asked and whether the answer even needs a layout, the data is fetched by tool, the model says what the answer means and never names a component, and rules choose the recipe, the arrangement and the components. The page is validated before it is shown, and the written answer is always one click away.",
    href: "/lab/generative-ui",
    status: "ready",
    covers: [
      "Intent planning",
      "Semantic report",
      "Layout recipes",
      "Validated spec",
      "Graceful fallback",
    ],
  },
];
