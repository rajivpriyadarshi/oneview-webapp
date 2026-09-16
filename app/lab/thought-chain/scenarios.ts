import type { ThoughtStep } from "./ThoughtChain";
import type { AnswerAnnotation } from "./grounding";

/**
 * Scripted runs for the thought-chain lab. Pure data — no API, no auth.
 * Add a scenario here and it shows up in the lab's control bar automatically.
 */

export type Scenario = {
  id: string;
  /** Label in the control bar. */
  name: string;
  /** What the user "types". Also used as the empty-state suggestion chip. */
  prompt: string;
  steps: ThoughtStep[];
  /** Markdown of the final answer, streamed in after the chain settles. */
  answer: string;
  /**
   * Masked PII to underline inside `answer`. Only terms that actually appear in
   * the answer text can be marked — a scenario whose answer names nobody has
   * nothing to underline, and that is the honest result rather than a bug.
   */
  annotations?: AnswerAnnotation[];
};

export const SCENARIOS: Scenario[] = [
  {
    id: "portfolio-review",
    name: "Portfolio review",
    prompt: "How has the portfolio performed in the last month?",
    steps: [
      {
        id: "client-context",
        label: "Client Context",
        bullets: [
          "Loaded client profile and portfolio context",
          "Retrieved relevant allocation and exposure history",
        ],
        icon: "/chat-workflow/family-context.png",
      },
      {
        id: "privacy-guard",
        kind: "system",
        glyph: "shield",
        systemLabel: "System · Privacy",
        verb: "Ran",
        label: "Privacy Guard",
        bullets: [
          "Detected PII in retrieved client data",
          {
            kind: "mask",
            // Fabricated, but shaped like the real thing — Singapore NRIC,
            // local mobile format. raw and masked must be the same length or
            // the wipe jitters; see MaskItem.
            items: [
              { key: "Client", raw: "Prashanth Ranganathan", masked: "••••••••• Ranganathan" },
              { key: "Account no.", raw: "8821-4471-0093", masked: "••••-••••-0093" },
              { key: "NRIC", raw: "S8412996J", masked: "S•••••96J" },
              { key: "Email", raw: "p.kumar@meridian-fo.sg", masked: "•••••••@meridian-fo.sg" },
              { key: "Mobile", raw: "+65 9123 4478", masked: "+65 •••• 4478" },
            ],
          },
          "Masked account identifiers and unnecessary personal details",
        ],
      },
      {
        id: "reasoning-router",
        kind: "system",
        glyph: "router",
        systemLabel: "System · Routing",
        verb: "Used",
        label: "Reasoning Router",
        bullets: [
          "Classified task as portfolio performance analysis",
          {
            kind: "route",
            from: "Portfolio performance",
            to: "Quantitative Reasoning",
          },
          // Deliberately not sorted by fit, and the winner is not the largest
          // model — the point of showing the evaluation is that it looks like a
          // judgement, not a lookup.
          {
            kind: "model-select",
            label: "Candidate models",
            candidates: [
              { name: "Haiku 4.5", note: "too shallow for numerics", fit: 0.34 },
              { name: "Sonnet 5", note: "best depth-to-latency fit", fit: 0.91 },
              { name: "Opus 5", note: "over-provisioned for task", fit: 0.68 },
            ],
            chosen: "Sonnet 5",
          },
          "Selected Sonnet 5 · Memory effort Medium",
        ],
      },
      {
        id: "portfolio-analyzer",
        verb: "Used",
        label: "Portfolio Analyzer",
        bullets: [
          "Loaded holdings, transactions and benchmark data",
          "Reconstructed portfolio state for the last month",
        ],
        icon: "/chat-workflow/portfolio-review.png",
      },
      {
        id: "performance-analyzer",
        verb: "Used",
        label: "Performance Analyzer",
        bullets: [
          "Calculated +3.8% monthly return · +60bps vs benchmark",
          "Technology identified as the largest contributor",
        ],
        icon: "/chat-workflow/portfolio-review.png",
      },
      {
        id: "risk-analyzer",
        verb: "Used",
        label: "Risk Analyzer",
        bullets: [
          "Technology exposure increased 21% → 29%",
          "USD exposure increased 49% → 56%",
        ],
        icon: "/chat-workflow/risk-alerts.png",
      },
      {
        id: "portfolio-insights",
        verb: "Ran",
        label: "Portfolio Insights",
        bullets: [
          "Connected performance gains with increasing concentration",
          "Prioritized the changes most relevant to the RM",
        ],
        icon: "/chat-workflow/portfolio-review.png",
      },
    ],
    answer: `Prashanth's discretionary mandate (account 8821-4471-0093) returned **+3.8%** over the last month, ahead of its blended benchmark by 60bps.

**What drove it**

- Technology holdings contributed the bulk of the gain, led by the semiconductor sleeve.
- Fixed income was flat as rate expectations settled.
- Real assets detracted slightly on a mark-down in the private real estate fund.

**Two things worth flagging**

- Technology exposure drifted from 21% to **29%**, now above the 25% policy ceiling.
- USD exposure rose from 49% to **56%**, which concentrates currency risk against the SGD reporting base.

Want me to draft a rebalancing proposal that brings both back inside policy?`,
    /** Same contract as meeting-prep's list below: terms must appear verbatim above. */
    annotations: [
      { term: "Prashanth", detected: "Prashanth Ranganathan", masked: "[CLIENT_NAME]" },
      { term: "8821-4471-0093", detected: "8821-4471-0093", masked: "[ACCOUNT_1]" },
    ],
  },
  {
    id: "meeting-prep",
    name: "Meeting prep",
    prompt: "Help me prepare for my next client meeting.",
    steps: [
      {
        id: "context",
        label: "Client Context",
        bullets: ["Loaded client profile and household structure", "Read the last three meeting notes"],
        icon: "/chat-workflow/family-context.png",
      },
      {
        // Distinct ids from the portfolio-review pair: the expand/collapse
        // overrides in ThoughtChain are keyed by step id and outlive a scenario
        // switch, so sharing ids would carry a hand-collapsed step across runs.
        id: "mp-privacy-guard",
        kind: "system",
        glyph: "shield",
        systemLabel: "System · Privacy",
        verb: "Ran",
        label: "Privacy Guard",
        bullets: [
          "Detected PII in client profile and meeting notes",
          {
            kind: "mask",
            // Same client as portfolio-review, different fields — these are the
            // ones meeting notes actually carry. raw and masked must be the same
            // length, and structural characters must sit at matching indices, or
            // the wipe jitters; see MaskItem.
            items: [
              { key: "Passport no.", raw: "K2284917S", masked: "K•••••17S" },
              { key: "DOB", raw: "12 Mar 1968", masked: "•• ••• 1968" },
              { key: "Mobile", raw: "+65 9123 4478", masked: "+65 •••• 4478" },
              { key: "Property", raw: "17 Nassim Road #04-02", masked: "•• •••••• •••• #04-02" },
              { key: "Account", raw: "DBS 8821-4478", masked: "DBS ••••-4478" },
              { key: "Entity", raw: "Ranganathan Family Trust", masked: "••••••••••• •••••• Trust" },
            ],
          },
          "Masked identity and address details before reasoning",
        ],
      },
      {
        id: "mp-reasoning-router",
        kind: "system",
        glyph: "router",
        systemLabel: "System · Routing",
        verb: "Used",
        label: "Reasoning Router",
        bullets: [
          "Classified task as client meeting preparation",
          {
            kind: "route",
            from: "Meeting preparation",
            to: "Advisory Synthesis",
          },
          // Lands on a different model than portfolio-review, and for a stated
          // reason: this run has to hold several notes against each other rather
          // than compute anything. The router looking like a judgement depends on
          // it not always reaching the same answer.
          {
            kind: "model-select",
            label: "Candidate models",
            candidates: [
              { name: "Haiku 4.5", note: "loses context across notes", fit: 0.29 },
              { name: "Sonnet 5", note: "capable, but flattens nuance", fit: 0.64 },
              { name: "Opus 5", note: "holds the full history in view", fit: 0.9 },
            ],
            chosen: "Opus 5",
          },
          "Selected Opus 5 · Memory effort High",
        ],
      },
      {
        id: "calendar",
        verb: "Checked",
        label: "Calendar",
        bullets: ["Found meeting on 18 Sep, 10:00 SGT", "Identified 4 open follow-ups from last review"],
        icon: "/chat-workflow/meeting-prep.png",
      },
      {
        id: "portfolio",
        verb: "Used",
        label: "Portfolio Analyzer",
        bullets: ["Compared allocation against the agreed policy", "Flagged two off-policy exposures"],
        icon: "/chat-workflow/portfolio-review.png",
      },
      {
        id: "brief",
        verb: "Ran",
        label: "Meeting Brief",
        bullets: ["Drafted an agenda with talking points", "Attached supporting charts"],
        icon: "/chat-workflow/meeting-prep.png",
      },
    ],
    answer: `Prashanth Ranganathan is considering a Singapore property purchase at 17 Nassim Road and is likely to need at least **$1M** of additional liquidity.

**Where he stands**

- He has indicated he would prefer borrowing against the portfolio held under the Ranganathan Family Trust rather than selling his NASDAQ position.
- A drawdown would settle into his DBS account 8821-4478. No final funding decision has been made.

**The tension**

- NASDAQ concentration remains elevated at **52.4%**, making this an important risk to discuss.
- But given the upcoming liquidity requirement, I'd avoid recommending a large equity sale solely to fund the property right now.

**What to focus on**

- Comparing borrowing against selective asset sales.
- Confirming the timing of the property purchase with Prashanth.
- Whether the current NASDAQ concentration still reflects his intended risk exposure.`,
    /**
     * Every identifier the Privacy Guard step masked that also surfaces in the
     * prose. The answer carries the real values — the advisor is cleared to see
     * them — and the underline says what the model was handed instead.
     *
     * Terms must appear verbatim in `answer` above or nothing underlines, and
     * they must not be split by MarkdownContent's number bolding, which is why
     * the account number is plain rather than wrapped in **.
     */
    annotations: [
      { term: "Prashanth Ranganathan", detected: "Prashanth Ranganathan", masked: "[CLIENT_NAME]" },
      { term: "Prashanth", detected: "Prashanth Ranganathan", masked: "[CLIENT_NAME]" },
      { term: "17 Nassim Road", detected: "17 Nassim Road #04-02", masked: "[ADDRESS_1]" },
      { term: "Ranganathan Family Trust", detected: "Ranganathan Family Trust", masked: "[ENTITY_1]" },
      { term: "8821-4478", detected: "8821-4478", masked: "[ACCOUNT_1]" },
    ],
  },
  {
    id: "liquidity",
    name: "Liquidity needs",
    prompt: "Any upcoming liquidity needs?",
    steps: [
      {
        id: "context",
        label: "Client Context",
        bullets: ["Loaded client context and cash accounts"],
        icon: "/chat-workflow/family-context.png",
      },
      {
        id: "lq-privacy-guard",
        kind: "system",
        glyph: "shield",
        systemLabel: "System · Privacy",
        verb: "Ran",
        label: "Privacy Guard",
        bullets: [
          "Detected PII in client context and cash accounts",
          {
            kind: "mask",
            // Same client again; the fields a funding question actually touches.
            // raw and masked must be the same length, structural characters at
            // matching indices, or the wipe jitters; see MaskItem.
            items: [
              { key: "Client", raw: "Prashanth Ranganathan", masked: "••••••••• Ranganathan" },
              { key: "Account", raw: "DBS 8821-4478", masked: "DBS ••••-4478" },
            ],
          },
          "Masked account identifiers before reasoning",
        ],
      },
      {
        id: "commitments",
        verb: "Read",
        label: "Commitment Schedule",
        bullets: [
          "Found 2 capital calls due within 90 days",
          "Totalled $2.4M of expected drawdowns",
        ],
        icon: "/chat-workflow/risk-alerts.png",
      },
      {
        id: "cash",
        verb: "Ran",
        label: "Cash Flow Projection",
        bullets: ["Projected cash balance across the next two quarters", "Identified a $600K shortfall in November"],
        icon: "/chat-workflow/portfolio-review.png",
      },
    ],
    answer: `Yes — **$2.4M** of capital calls land against Prashanth's portfolio in the next 90 days.

- **Oct 12** — private credit fund III, $1.4M
- **Nov 20** — real assets co-invest, $1.0M

Current cash of $1.8M in DBS 8821-4478 covers the first call comfortably, but leaves a **~$600K shortfall in November**.

Easiest fix is trimming the liquid ETF sleeve, which also helps with the technology overweight. Shall I size that trade?`,
    annotations: [
      { term: "Prashanth", detected: "Prashanth Ranganathan", masked: "[CLIENT_NAME]" },
      { term: "8821-4478", detected: "DBS 8821-4478", masked: "[ACCOUNT_1]" },
    ],
  },
];

export const DEFAULT_SCENARIO_ID = SCENARIOS[0].id;
