"use client";

/**
 * The renderer. The only thing in the system that turns a spec into pixels.
 *
 * It does three jobs and refuses to do a fourth:
 *
 *   1. **Resolve.** Walk the tree once, and for every node work out the finding, the
 *      bundle value and the provenance behind it. Pure, up-front, and stored in a
 *      map — not computed during render, so a StrictMode double-render cannot change
 *      what a node is bound to.
 *   2. **Dispatch.** Look the component id up in the registry. A name that is not
 *      there renders a visible note, never a crash and never a blank.
 *   3. **Contain failure.** Every node sits inside an error boundary. One component
 *      throwing on an unexpected shape costs that area, not the page — which is what
 *      makes §14's "graceful fallback is non-negotiable" true at the component level
 *      as well as at the view level.
 *
 * The fourth job it does not do: interpret. It never formats a figure the semantic
 * report did not already format, never derives a value, never picks a component. By
 * the time a spec reaches here every one of those decisions has been made and
 * validated. That is what makes this file boring, and it should stay boring.
 */

import React, { type CSSProperties } from "react";
import { resolveKey, type DataBundle } from "./data";
import { CONTAINER_COMPONENTS, isLayoutId } from "./containers";
import { LEAF_COMPONENTS, isLeafId, type Provenance, type Resolved } from "./leaves";
import { measureGroup, type Finding } from "./findings";
import { REGISTRY, specOf } from "./registry";
import { headlineFigures, openingSection, type SemanticReport } from "./semantic";
import { childrenOf, type UINode, type UISpec } from "./spec";
import { INK, LABEL } from "./chrome";
import { TYPE } from "./ds";

/* ------------------------------------------------------------------ resolve */

/**
 * Which finding a node renders.
 *
 * The node names a `sectionId`; the section holds one or more findings; the registry
 * says which finding kinds the component accepts. Where a section has several
 * findings and several nodes, each node claims the first *unclaimed* one it accepts,
 * so a chart and a callout over the same section do not both render the same claim.
 *
 * Deliberately not a `findingId` on the node. The composer's job is to say "present
 * this section this way"; making it also address individual findings would give it a
 * second, finer handle on the report's contents for no gain — the accepts-list
 * already carries the information, and one fewer field is one fewer thing to
 * validate.
 */
function claimFinding(
  node: UINode,
  report: SemanticReport | undefined,
  claimed: Set<string>,
): Finding | undefined {
  if (!report || !node.sectionId) return undefined;
  /*
   * A container renders children, never a claim.
   *
   * It matters the moment a container carries a `sectionId`, which `Section` now does so
   * the renderer can read the section's takeaway. Without this line the section itself
   * claimed one of its own findings on the way past, and the leaf underneath — finding
   * nothing unclaimed left — fell back to the section's first finding and printed the net
   * worth under a "Total assets" label. The claim mechanism is for leaves; a container has
   * no way to render a finding even if it were handed one.
   */
  if (isLayoutId(node.component)) return undefined;
  const section = report.sections.find((entry) => entry.id === node.sectionId);
  if (!section) return undefined;

  const { accepts } = specOf(node.component);
  const fits = section.findings.filter((finding) => accepts.includes(finding.kind));
  const pool = fits.length > 0 ? fits : section.findings;

  const fresh = pool.find((finding) => !claimed.has(finding.id));
  const chosen = fresh ?? pool[0];
  if (chosen) claimed.add(chosen.id);
  return chosen;
}

/**
 * The report's own writing, reached by reference rather than by copy.
 *
 * `report.summary` and `report.narrative` are prose the analysis authored, and the
 * document needs them on the page — the reference layout's "Executive summary" is
 * exactly this. Putting the text into `props` would have been simpler and wrong: props
 * are presentation, the validator rejects content found in them, and a spec carrying a
 * copy of the answer is a spec that can disagree with the answer. So the node carries
 * `source: "summary"` — a reference, the same shape of promise `dataKey` makes about the
 * bundle — and resolution reads the live value here.
 */
const reportText = (node: UINode, report: SemanticReport | undefined): unknown => {
  const source = node.props.source;
  /* The closing paragraph and its signature, as the pair the report wrote them as — two
     strings, resolved together, because they are one passage with a name under it. */
  if (source === "outlook") return report?.outlook;
  /*
   * The one line worth pulling out beside the summary.
   *
   * Resolved rather than composed: the takeaway belongs to a section, and which section
   * is the primary one is a fact the analysis stated in `importance`. The composer knows
   * the node exists; it does not know, and cannot write, what the node says.
   */
  if (source === "takeaway") return report ? openingSection(report)?.takeaway : undefined;
  if (source !== "summary" && source !== "narrative") return undefined;
  return report?.[source];
};

/**
 * The sibling findings a table's columns come from.
 *
 * Only for components that tabulate several measures over one set of entities. The
 * predicate lives in findings.ts and is shared with the composer on purpose: the
 * composer chose a table *because* this group exists, so collecting a different group
 * here would build the table out of claims it was not chosen for.
 *
 * Marking the whole group claimed matters. Without it the section's other measures are
 * still unclaimed, and a second node over the same section would render one of them
 * again — the reader would see the table and then one of its own columns repeated.
 */
function claimGroup(
  node: UINode,
  report: SemanticReport | undefined,
  finding: Finding | undefined,
  claimed: Set<string>,
): Finding[] | undefined {
  /*
   * The headline strip, whose figures come from across the report rather than from one
   * section — so it has no `sectionId` and cannot be resolved by the per-section claim.
   * `headlineFigures` is the same rule the composer used to decide the strip exists and
   * to claim its figures, which is why the strip shows exactly what the sections below
   * are no longer printing.
   */
  if (node.component === "MetricStrip" && node.props.source === "key_figures") {
    if (!report) return undefined;
    const figures = headlineFigures(report);
    for (const member of figures) claimed.add(member.id);
    return figures.length >= 2 ? figures : undefined;
  }

  if (node.component !== "ComparisonTable" || !finding || !report || !node.sectionId) return undefined;
  const section = report.sections.find((entry) => entry.id === node.sectionId);
  if (!section) return undefined;

  const group = measureGroup(section.findings, finding);
  for (const member of group) claimed.add(member.id);
  return group.length > 1 ? group : undefined;
}

/** One pure pass over the tree, so render itself resolves nothing. */
function resolveAll(spec: UISpec, report: SemanticReport | undefined, bundle: DataBundle): Map<string, Resolved> {
  const resolved = new Map<string, Resolved>();
  const claimed = new Set<string>();

  const visit = (node: UINode): void => {
    const finding = claimFinding(node, report, claimed);
    resolved.set(node.id, {
      node,
      props: node.props,
      finding,
      group: claimGroup(node, report, finding, claimed),
      value: node.dataKey ? resolveKey(bundle, node.dataKey) : reportText(node, report),
      provenance: node.dataKey ? (bundle.provenance[node.dataKey] as Provenance | undefined) : undefined,
    });
    for (const child of childrenOf(node)) visit(child);
  };

  for (const node of spec.root) visit(node);
  return resolved;
}

/* --------------------------------------------------------------- boundaries */

type BoundaryProps = { label: string; children: React.ReactNode };

/**
 * Per-node containment.
 *
 * A class component because that is still the only way to catch a render error in
 * React. The fallback names the component rather than the error: a reader does not
 * need the stack, and a reviewer looking at the screen needs to know which entry in
 * the registry misbehaved.
 */
class NodeBoundary extends React.Component<BoundaryProps, { failed: boolean }> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="rounded-[12px] border border-dashed border-black/15 bg-black/[0.02] p-[14px]">
          <div className={LABEL}>Could not render</div>
          <div className="mt-[6px] font-satoshi text-[12px] text-black/45">
            {this.props.label} failed on this data. The rest of the view is unaffected.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Unsupported({ id }: { id: string }) {
  return (
    <div className="rounded-[12px] border border-dashed border-black/15 p-[14px]">
      <div className={LABEL}>Unknown component</div>
      <div className="mt-[6px] font-satoshi text-[12px] text-black/45">
        &ldquo;{id}&rdquo; is not in the approved registry, so it was not rendered.
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- dispatch */

type Ctx = { resolved: Map<string, Resolved>; docTitle?: string; report?: SemanticReport };

function NodeView({ node, ctx, index }: { node: UINode; ctx: Ctx; index?: number }) {
  if (!(node.component in REGISTRY)) return <Unsupported id={String(node.component)} />;

  const rendered = (
    <NodeBoundary label={node.component}>
      <Dispatch node={node} ctx={ctx} />
    </NodeBoundary>
  );

  // `span` is the node's own request for width. Absent, the container decides,
  // which is the common case and the one the recipes are built around.
  const span = node.span === undefined ? undefined : `span ${Math.min(node.span, 12)}`;

  /*
   * `index` is the node's position among its siblings, and the only thing the renderer
   * does with it is stagger the arrival animation (see `AssemblyStyles`). It is not
   * available to the composer and changes nothing about what is rendered — a wrapper
   * div and a custom property.
   */
  if (index === undefined && span === undefined) return rendered;
  return (
    <div
      className={index === undefined ? undefined : "gu-item"}
      // Clamped: past the sixth card the wait stops reading as sequence and starts
      // reading as lag.
      style={{ gridColumn: span, ...(index === undefined ? {} : { "--gu-i": Math.min(index, 6) }) } as CSSProperties}
    >
      {rendered}
    </div>
  );
}

function Dispatch({ node, ctx }: { node: UINode; ctx: Ctx }) {
  const kids = (node.children ?? []).map((child, index) => (
    <NodeView key={child.id} node={child} ctx={ctx} index={index} />
  ));
  const slots = Object.fromEntries(
    Object.entries(node.slots ?? {}).map(([name, region]) => [
      name,
      region.map((child, index) => <NodeView key={child.id} node={child} ctx={ctx} index={index} />),
    ]),
  );

  if (isLayoutId(node.component)) {
    const container = CONTAINER_COMPONENTS[node.component];
    /* The section's own line, read from the report the node points at. `props.takeaway` is
       the composer saying "show it"; this is the only place that knows what it says. */
    const takeaway =
      node.props.takeaway === true && node.sectionId
        ? ctx.report?.sections.find((section) => section.id === node.sectionId)?.takeaway
        : undefined;
    return (
      <>{container({ node, props: node.props, children: kids, slots, docTitle: ctx.docTitle, takeaway })}</>
    );
  }

  if (isLeafId(node.component)) {
    const input = ctx.resolved.get(node.id) ?? { node, props: node.props };
    return <>{LEAF_COMPONENTS[node.component](input)}</>;
  }

  return <Unsupported id={node.component} />;
}

/* ------------------------------------------------------------------- entry */

export function SpecRenderer({
  spec,
  report,
  bundle,
  revealed,
}: {
  spec: UISpec;
  /** Optional: without it, leaves fall back to their bundle bindings. */
  report?: SemanticReport;
  bundle: DataBundle;
  /**
   * How many top-level areas have landed. Omitted means all of them, instantly —
   * which is what a reopened view wants, and what the tests want.
   */
  revealed?: number;
}) {
  // Resolution is keyed on the three inputs, so a patch to the spec re-resolves and
  // a re-render for any other reason does not.
  const resolved = React.useMemo(() => resolveAll(spec, report, bundle), [spec, report, bundle]);
  const ctx: Ctx = { resolved, docTitle: report?.title, report };
  const count = revealed ?? spec.root.length;

  return (
    // 40px between top-level areas, matching `RHYTHM.section`. The rhythm between
    // areas is the document's coarsest signal and it has to be larger than the rhythm
    // *inside* an area, or the reader cannot tell where one section ends.
    <div className="flex flex-col gap-[40px]">
      {spec.root.slice(0, count).map((node) => (
        // Keyed on the node, so a landed area is never remounted by a later one
        // arriving — its build animation runs once, when it first appears.
        <Assembling key={node.id} node={node}>
          <NodeView node={node} ctx={ctx} />
        </Assembling>
      ))}
      <AssemblyStyles />
    </div>
  );
}

/* ---------------------------------------------------------------- assembly
 *
 * The three-beat build, ported from ../dynamic-ui/ReportView.tsx:
 *
 *   1. the area's frame arrives, empty;
 *   2. a shimmering scaffold stands in for its contents while a gradient outline
 *      runs round the edge — the "being assembled" beat;
 *   3. the outline settles, the scaffold cross-fades out, and the real content
 *      unblurs into the frame it was already occupying.
 *
 * All CSS keyframes on a stable, keyed element. Two consequences worth keeping: the
 * scaffold is absolutely positioned, so the block's height is the *finished* content's
 * height from the first frame and nothing below it jumps mid-build; and because none
 * of it is JS, a re-render for any other reason cannot restart a build.
 */

const SCAFFOLD_BARS = [58, 92, 78, 40];

function Assembling({ node, children }: { node: UINode; children: React.ReactNode }) {
  // The page header is a line of type, not a card. Giving it a scaffold makes the
  // top of the page flash a block that was never there.
  const plain = node.component === "PageHeader";

  /*
   * Who performs the fill: the area, or its cards.
   *
   * An area with several children — the usual Grid of Metrics — animates nothing
   * itself. Fading the whole area in at once is what made a four-card row arrive as a
   * single object; instead each card carries its own `gu-item` fill and they land in
   * document order. An area that *is* one component keeps the single fill, because
   * there is nothing to sequence.
   */
  const sequenced = childrenOf(node).length > 1;

  return (
    <div className="gu-block">
      {plain ? null : (
        <>
          <div className="gu-plate" aria-hidden />
          <div className="gu-scaffold" aria-hidden>
            {SCAFFOLD_BARS.map((width, index) => (
              <div
                key={index}
                className="gu-bar"
                style={{ width: `${width}%`, animationDelay: `${index * 90}ms` }}
              />
            ))}
          </div>
          <div className="gu-outline" aria-hidden />
        </>
      )}
      <div className={plain || sequenced ? undefined : "gu-fill"}>{children}</div>
    </div>
  );
}

/** Rendered once per view. Inlined rather than global so the lab owns its own motion. */
function AssemblyStyles() {
  return (
    <style>{`
      /* Registered so the conic gradient's angle can be animated at all — custom
         properties are strings to the animation engine otherwise. */
      @property --gu-angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }

      @keyframes gu-frame-in {
        0%   { opacity: 0; transform: translateY(16px) scale(0.96); }
        70%  { opacity: 1; transform: translateY(0) scale(1.008); }
        100% { opacity: 1; transform: none; }
      }
      @keyframes gu-fill-in {
        0%   { opacity: 0; transform: translateY(10px); filter: blur(7px); }
        60%  { opacity: 1; filter: blur(0.6px); }
        100% { opacity: 1; transform: none; filter: blur(0); }
      }
      @keyframes gu-outline-spin { to { --gu-angle: 360deg; } }
      @keyframes gu-outline-out {
        0% { opacity: 0 } 12% { opacity: 1 } 70% { opacity: 1 } 100% { opacity: 0 }
      }
      @keyframes gu-scaffold-out {
        0% { opacity: 0 } 15% { opacity: 1 } 62% { opacity: 1 } 100% { opacity: 0 }
      }
      @keyframes gu-bar-shimmer {
        from { background-position: -180% 0 } to { background-position: 180% 0 }
      }
      @keyframes gu-sheen {
        from { background-position: -160% 0; opacity: 0.85 }
        to   { background-position: 160% 0; opacity: 0 }
      }

      .gu-block { position: relative; animation: gu-frame-in 720ms cubic-bezier(0.22, 1, 0.36, 1) both; }
      .gu-fill { animation: gu-fill-in 900ms 620ms cubic-bezier(0.22, 1, 0.36, 1) both; }
      /* One card at a time, in document order, starting once the area's frame has
         arrived. 150ms is short enough to read as one gesture and long enough that the
         eye lands on each card separately. */
      .gu-item {
        animation: gu-fill-in 760ms cubic-bezier(0.22, 1, 0.36, 1) both;
        animation-delay: calc(560ms + var(--gu-i, 0) * 150ms);
      }
      .gu-plate {
        position: absolute; inset: 0; border-radius: 14px; background: #fff;
        box-shadow: 0 1px 2px rgba(0,0,0,0.04); pointer-events: none;
        animation: gu-scaffold-out 1500ms ease-out both;
      }
      .gu-scaffold {
        position: absolute; inset: 0; border-radius: 14px; padding: 16px;
        display: flex; flex-direction: column; gap: 9px; pointer-events: none;
        animation: gu-scaffold-out 1500ms ease-out both;
      }
      .gu-bar {
        height: 8px; border-radius: 4px;
        background-image: linear-gradient(100deg, rgba(23,22,21,0.05) 30%, rgba(127,78,11,0.16) 50%, rgba(23,22,21,0.05) 70%);
        background-size: 220% 100%;
        animation: gu-bar-shimmer 1100ms linear infinite;
      }
      /* The AI outline: a gradient that runs round the edge while the area is being
         built, then fades off once its content is in. */
      .gu-outline {
        position: absolute; inset: -1.5px; border-radius: 15.5px; padding: 1.5px;
        pointer-events: none;
        background: conic-gradient(
          from var(--gu-angle),
          rgba(127,78,11,0.05) 0deg,
          #7F4E0B 60deg,
          #E0A34E 120deg,
          #9A6BE0 200deg,
          #4B7FD4 265deg,
          rgba(127,78,11,0.05) 360deg
        );
        -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        -webkit-mask-composite: xor;
        mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        mask-composite: exclude;
        animation: gu-outline-spin 1150ms linear 2, gu-outline-out 1700ms ease-out both;
      }
      /* One pass of light across the finished area. Driven by background-position so
         it needs no clipping wrapper and cannot escape the block's box. */
      .gu-block::after {
        content: ""; position: absolute; inset: 0; border-radius: 14px;
        pointer-events: none; mix-blend-mode: overlay;
        background-image: linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.9) 50%, transparent 70%);
        background-size: 220% 100%; background-repeat: no-repeat;
        animation: gu-sheen 1100ms 900ms cubic-bezier(0.4, 0, 0.2, 1) both;
      }

      @media (prefers-reduced-motion: reduce) {
        .gu-block, .gu-fill, .gu-item { animation-duration: 1ms; animation-delay: 0ms }
        .gu-block::after, .gu-outline, .gu-scaffold, .gu-plate, .gu-bar { animation: none; display: none }
      }
    `}</style>
  );
}

/**
 * The fallback, and the reason the rich path is allowed to fail.
 *
 * Not a placeholder and not an error state — it is the answer, in the form the
 * advisor would have got anyway. §14 states it plainly: the semantic result always
 * remains available, and rich UI is an enhancement, never the source of truth.
 */
export function NarrativeFallback({ title, narrative }: { title?: string; narrative: string }) {
  return (
    // Set on the same scale as the composed document, deliberately. The fallback is the
    // authoritative answer, so it should not look like a degraded version of the view —
    // it should look like the same report with fewer components in it.
    <article>
      {title ? <h1 className={TYPE.docTitle}>{title}</h1> : null}
      <div className={title ? "mt-[20px]" : ""}>
        {narrative.split(/\n{2,}/).map((paragraph, index) => (
          <p key={index} className={`${TYPE.body} ${index === 0 ? "" : "mt-[14px]"}`}>
            {paragraph}
          </p>
        ))}
      </div>
    </article>
  );
}
