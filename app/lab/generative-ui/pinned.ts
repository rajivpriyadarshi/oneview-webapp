/**
 * The pinned clients, and how a query picks one.
 *
 * The freeze point is explained in ./prashanth.ts: layers 2 and 3 are hand-authored,
 * layers 4 onwards run live over them. This file is only the registry and the matcher —
 * the part that has to be shared once there is more than one client, and the part that
 * has to stay honest about which client is being answered.
 *
 * Two rules, and both matter more than they look:
 *
 *   1. **A name in the query wins over the selector.** The selector is a simulator
 *      control; the query is what the advisor asked. Asking about Eleanor while the
 *      selector says Prashanth and getting Prashanth's balance sheet would be the worst
 *      failure this system has, because every figure on it would look plausible.
 *   2. **The selector only chooses whose book to open, never whether to open one.** An
 *      unrelated question with a client selected still goes to the live pipeline. The
 *      selector is not a switch that turns one fixture into the answer to everything.
 */

import { ELEANOR_ANSWER, ELEANOR_BUNDLE, ELEANOR_PLAN, ELEANOR_REPORT } from "./eleanor";
import { PRASHANTH_ANSWER, PRASHANTH_BUNDLE, PRASHANTH_PLAN, PRASHANTH_REPORT } from "./prashanth";
import type { DataBundle } from "./data";
import type { IntentPlan } from "./intent";
import type { SemanticReport } from "./semantic";

export type PinnedRun = {
  plan: IntentPlan;
  bundle: DataBundle;
  report: SemanticReport;
  answer: string;
  /** Said out loud in the chat. A pinned answer that looks live is a lie. */
  note: string;
};

export type PinnedClientId = "prashanth" | "eleanor";

export type PinnedClient = {
  id: PinnedClientId;
  /** As it appears in the selector. */
  name: string;
  /** One line under the name: what makes this client's report a different shape. */
  distinction: string;
  /** Names and entities that identify this client in a question. */
  pattern: RegExp;
  run: Omit<PinnedRun, "note">;
};

export const PINNED_CLIENTS: PinnedClient[] = [
  {
    id: "prashanth",
    name: "Prashanth Ranganathan",
    distinction: "Listed-heavy, leveraged, a benchmark to beat",
    pattern: /prashanth|ranganathan|prtr/,
    run: {
      plan: PRASHANTH_PLAN,
      bundle: PRASHANTH_BUNDLE,
      report: PRASHANTH_REPORT,
      answer: PRASHANTH_ANSWER,
    },
  },
  {
    id: "eleanor",
    name: "Eleanor Whitfield",
    distinction: "Property and private holdings, no debt, three owners",
    pattern: /eleanor|whitfield/,
    run: {
      plan: ELEANOR_PLAN,
      bundle: ELEANOR_BUNDLE,
      report: ELEANOR_REPORT,
      answer: ELEANOR_ANSWER,
    },
  },
];

export const pinnedClient = (id: PinnedClientId): PinnedClient =>
  PINNED_CLIENTS.find((client) => client.id === id) ?? PINNED_CLIENTS[0];

/**
 * Does this question want a pinned report, and whose?
 *
 * Deliberately narrow on the second half. A generous matcher would be the worse failure:
 * it would silently answer unrelated questions with a fixture, and the lab would stop
 * exercising the pipeline at all. Anything this does not recognise goes to the model
 * exactly as before.
 */
export function pinnedRun(query: string, selected: PinnedClientId = "prashanth"): PinnedRun | null {
  const text = query.toLowerCase();

  const named = PINNED_CLIENTS.find((client) => client.pattern.test(text));
  const wants =
    /(portfolio|balance sheet|net worth|holdings|property|real estate|wealth)/.test(text) &&
    /(analys|report|review|overview|breakdown|summar|how is|what is|where)/.test(text);

  /* An unnamed request for "the portfolio report" is about whoever the selector has
     open — which is how the same question produces two different pages, and the whole
     point of the control. Naming a client overrides it. */
  const client = named ?? (wants ? pinnedClient(selected) : undefined);
  if (!client) return null;

  return {
    ...client.run,
    note: `Pinned report for ${client.name}: the data and the analysis are a fixture, and the layout is composed live from them.`,
  };
}
