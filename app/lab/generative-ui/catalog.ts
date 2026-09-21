/**
 * The json-render catalogue, derived from layer 6 rather than written beside it.
 *
 * json-render calls this the guardrail: `defineCatalog` states what may exist, and
 * anything outside it fails to render. That is the same job `REGISTRY` already does,
 * so this file translates rather than restates — one `REGISTRY` entry in, one
 * catalogue component out. Hand-writing the catalogue would put two definitions of
 * one contract in the repo, which is the exact criticism levelled at the old
 * prototype for keeping a JSON Schema next to `findings.ts`.
 *
 * What json-render gives us that layer 6 did not have:
 *
 *   - `{ "$state": "/key" }` expressions, which are data-key indirection as a
 *     first-class primitive rather than a convention this codebase enforces alone.
 *   - `validateSpec` / `autoFixSpec`, a structural gate and a repair pass over the
 *     spec shape, so ./validate.ts only has to hold the rules that are *ours*:
 *     no figures in props, and the UX heuristics.
 *   - `applySpecPatch` / `diffToPatches` / `buildEditInstructions`, which is the
 *     conversational-editing machinery (§11) that was still unbuilt here.
 *
 * What it does NOT change: the model still does not author the spec. json-render's
 * default mode has the model emit the spec as JSONL patches, and that is precisely
 * what the brief forbids — composition stays in ./compose.ts, deterministic, with no
 * model in it. We use json-render as the substrate underneath the composer, not as a
 * replacement for it.
 */

import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";
import { REGISTRY, type ComponentId, type ComponentSpec } from "./registry";

/**
 * The prop every bound component gains.
 *
 * A spec node's `dataKey` becomes `props.data: { "$state": "/<key>" }`, which
 * json-render resolves against the bundle before the component is called. The
 * component therefore receives the *value* and the spec still holds only the
 * *key* — the indirection survives, and it is now the library's mechanism rather
 * than ours to maintain.
 */
const DATA_PROP = z.object({ data: z.unknown().optional() });

/**
 * Slot names for a component, in json-render's vocabulary.
 *
 * `"default"` is the flat child list; named regions (Tabs' labels, SplitPane's two
 * sides) come across verbatim, because the validator already checks region names
 * against `children.named` and the two must agree.
 */
function slotsOf(spec: ComponentSpec): string[] | undefined {
  if (spec.children.allowed === "none") return undefined;
  const named = Object.keys(spec.children.named ?? {});
  return ["default", ...named];
}

/** `propsSchema` merged with `data` where the component binds. */
function propsOf(spec: ComponentSpec): z.ZodType {
  if (!spec.requiresData) return spec.propsSchema;
  // Every REGISTRY entry is a z.object; the guard keeps a future non-object entry
  // from silently losing its binding rather than failing loudly here.
  const base = spec.propsSchema;
  return base instanceof z.ZodObject ? base.extend(DATA_PROP.shape) : z.intersection(base, DATA_PROP);
}

const components = Object.fromEntries(
  (Object.keys(REGISTRY) as ComponentId[]).map((id) => {
    const spec = REGISTRY[id];
    const slots = slotsOf(spec);
    return [
      id,
      {
        props: propsOf(spec),
        description: `${spec.description} Use when: ${spec.useWhen}`,
        ...(slots ? { slots } : {}),
      },
    ];
  }),
);

/**
 * No actions, deliberately.
 *
 * json-render lets a spec trigger operations, which is how its playground gets
 * buttons that submit forms. Interactivity here has to arrive as a bounded action
 * vocabulary that cannot mutate a figure, and that has not been designed yet — an
 * empty map is the honest state of it rather than a placeholder someone fills in.
 */
export const CATALOG = defineCatalog(schema, { components, actions: {} });

/** Every id the catalogue knows, for the coverage assertion in the tests. */
export const CATALOG_IDS = Object.keys(components) as ComponentId[];
