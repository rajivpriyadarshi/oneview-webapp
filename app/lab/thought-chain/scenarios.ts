import type { ThoughtStep } from "./ThoughtChain";

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
        verb: "Ran",
        label: "Privacy Guard",
        bullets: [
          "Detected PII in retrieved client data",
          "Masked account identifiers and unnecessary personal details",
        ],
        icon: "/chat-workflow/risk-alerts.png",
      },
      {
        id: "reasoning-router",
        verb: "Used",
        label: "Reasoning Router",
        bullets: [
          "Classified task as portfolio performance analysis",
          "Selected Quantitative Reasoning · Medium effort",
        ],
        icon: "/chat-workflow/meeting-prep.png",
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
    answer: `The portfolio returned **+3.8%** over the last month, ahead of its blended benchmark by 60bps.

**What drove it**

- Technology holdings contributed the bulk of the gain, led by the semiconductor sleeve.
- Fixed income was flat as rate expectations settled.
- Real assets detracted slightly on a mark-down in the private real estate fund.

**Two things worth flagging**

- Technology exposure drifted from 21% to **29%**, now above the 25% policy ceiling.
- USD exposure rose from 49% to **56%**, which concentrates currency risk against the SGD reporting base.

Want me to draft a rebalancing proposal that brings both back inside policy?`,
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
    answer: `Your next meeting is **Thu 18 Sep, 10:00 SGT** with Prashanth. Here's a running order.

**Open from last time**

- Trust structure review — legal draft still pending.
- Confirmation on the private credit commitment.

**What to lead with**

- Performance: +3.8% since last review, ahead of benchmark.
- Two off-policy exposures to resolve: technology at 29%, USD at 56%.

**Ask for a decision on**

- Trimming the semiconductor sleeve back toward 25%.
- Hedging a portion of the USD exposure.`,
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
    answer: `Yes — **$2.4M** of capital calls land in the next 90 days.

- **Oct 12** — private credit fund III, $1.4M
- **Nov 20** — real assets co-invest, $1.0M

Current cash of $1.8M covers the first call comfortably, but leaves a **~$600K shortfall in November**.

Easiest fix is trimming the liquid ETF sleeve, which also helps with the technology overweight. Shall I size that trade?`,
  },
];

export const DEFAULT_SCENARIO_ID = SCENARIOS[0].id;
