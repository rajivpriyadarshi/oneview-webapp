"use client";

/**
 * The text-shaped findings, rebuilt as parts of a document.
 *
 * Everything here used to be a delegation to `../dynamic-ui/renderers.tsx`, and everything
 * there is a tinted rounded box: a flag, a recommendation, a checklist and a transition all
 * arrive as a filled panel with an uppercase chip at the top. On a dashboard, where each
 * widget is an island, that reads fine. On a page with nine sections it produces a column
 * of coloured rectangles in which nothing is more important than anything else — which is
 * the specific thing that made the report look assembled rather than written.
 *
 * So the box is gone and the accent is a 2px rule. That is the whole idea: the reader's eye
 * still finds a flag immediately, the severity is still stated in a word, and the detail
 * still sits in the document's own body type rather than in a panel's smaller one. A
 * critical flag gets a slightly heavier rule and a faint wash; nothing gets a border.
 *
 * None of these choose a colour from a prop. Severity comes from the finding's `severity`,
 * direction from its `sentiment` — see `SEVERITY` and `toneOf` in ./ds.ts for why that is a
 * §9 constraint and not a style preference.
 */

import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import React from "react";
import { Block } from "./chrome";
import { RHYTHM, SEVERITY, TYPE, pill, toneOf, type SeverityName } from "./ds";
import type {
  ChecklistFinding,
  FlagFinding,
  NarrativeFinding,
  RecommendationFinding,
  RequirementFinding,
  TransitionFinding,
} from "./findings";

/* ------------------------------------------------------------------- shared */

/**
 * The one shape every called-out finding takes: a rule, a word, a claim, the detail.
 *
 * Extracted because four kinds share it and a divergence between them is exactly what
 * made the old page noisy — four components each choosing their own padding, radius and
 * label size for what is, to a reader, the same gesture.
 */
function Called({
  hex,
  word,
  title,
  children,
  wash = false,
  lead,
}: {
  hex: string;
  word?: string;
  title: string;
  children?: React.ReactNode;
  /** A faint tint behind the whole thing. Reserved for `critical`. */
  wash?: boolean;
  /** Furniture before the word — a number, a tick box. */
  lead?: React.ReactNode;
}) {
  return (
    <div
      className={`relative pl-[16px] ${wash ? "-my-[2px] rounded-r-[6px] py-[10px] pr-[14px]" : ""}`}
      style={wash ? { background: `${hex}0D` } : undefined}
    >
      <span
        className="absolute top-[3px] bottom-[3px] left-0 w-[2px] rounded-full"
        style={{ background: hex }}
        aria-hidden
      />
      {word || lead ? (
        <div className="mb-[5px] flex items-center gap-[8px]">
          {lead}
          {word ? (
            <span
              className="font-satoshi text-[10px] font-bold uppercase tracking-[0.1em]"
              style={{ color: hex }}
            >
              {word}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="font-satoshi text-[15px] font-semibold leading-[1.4] text-[#171615]">{title}</div>
      {children ? <div className="mt-[6px]">{children}</div> : null}
    </div>
  );
}

const Detail = ({ text }: { text: string }) => <p className={`${TYPE.body} m-0`}>{emphasise(text)}</p>;

/**
 * `**bold**` → `<strong>`, and nothing else.
 *
 * Split rather than parsed: an alternating split on a capturing regex puts the delimited
 * runs at odd indices, which is enough for one inline mark and cannot produce malformed
 * output the way a partial markdown parser can. The analysis writes its figures in bold
 * and dropping the emphasis would flatten the sentence carrying the answer.
 */
export const emphasise = (raw: string): React.ReactNode[] =>
  raw.split(/\*\*(.+?)\*\*/g).map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="font-semibold text-[#171615]">
        {part}
      </strong>
    ) : (
      part
    ),
  );

/* -------------------------------------------------------------------- flags */

/**
 * Something that needs attention, as a card in a set.
 *
 * The rule-and-word treatment this replaces was right about one thing — a page of peach
 * rectangles has no hierarchy — and wrong about the case that matters most. Four risks are
 * not four paragraphs in a column; they are a set, and a reader's first question about a set
 * is how big it is and how bad. A card carries that: the tint says the severity before a
 * word is read, the chip says which level, and two of them side by side say "four items,
 * one serious" in one glance. The composer puts them in a grid when there is more than one
 * (see `buildArea`), which is what keeps this from becoming a column of boxes again.
 *
 * Every colour here is `SEVERITY[finding.severity]` at a chosen alpha. Nothing picks a hue.
 */
const MARKS: Record<SeverityName, typeof AlertTriangle> = {
  info: Info,
  warn: AlertCircle,
  critical: AlertTriangle,
};

export function FlagBlock({ finding }: { finding: FlagFinding }) {
  const level = SEVERITY[finding.severity];
  const Mark = MARKS[finding.severity];
  return (
    <div
      className="flex h-full gap-[12px] rounded-[12px] border p-[16px]"
      style={{ background: `${level.hex}0A`, borderColor: `${level.hex}26` }}
    >
      <span
        className="mt-[1px] grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full"
        style={{ background: `${level.hex}1F`, color: level.hex }}
        aria-hidden
      >
        <Mark className="h-[14px] w-[14px]" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-[10px]">
          <div className="font-satoshi text-[14px] font-semibold leading-[1.4] text-[#171615]">
            {finding.subjectLabel}
          </div>
          <span
            className="mt-[1px] shrink-0 rounded-[5px] px-[6px] py-[2px] font-satoshi text-[11px] font-medium"
            style={{ background: `${level.hex}1A`, color: level.hex }}
          >
            {level.word}
          </span>
        </div>
        {finding.detail ? (
          <p className={`${TYPE.body} m-0 mt-[6px] text-[14px] leading-[1.6]`}>{emphasise(finding.detail)}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * It moved from A to B.
 *
 * The two states side by side with an arrow between them, at figure size, because the
 * pair *is* the claim — "21% → 29%" said in one line is the whole finding, and burying it
 * in a sentence makes the reader reconstruct it.
 */
export function TransitionBlock({ finding }: { finding: TransitionFinding }) {
  const tone = toneOf(undefined, finding.sentiment);
  return (
    <div className={RHYTHM.tight}>
      <div className={TYPE.label}>{finding.subjectLabel}</div>
      <div className="flex items-baseline gap-[10px]">
        <span className={`${TYPE.figureSm} text-black/45`}>{finding.from}</span>
        <span className="font-satoshi text-[15px] text-black/30">→</span>
        <span className={TYPE.figureSm}>{finding.to}</span>
        <span className={pill(tone)}>{finding.sentiment === "negative" ? "Watch" : "Moved"}</span>
      </div>
      {finding.note ? <Detail text={finding.note} /> : null}
    </div>
  );
}

/* -------------------------------------------------------------- requirement */

/**
 * An amount needed by a date.
 *
 * The date is the part that makes it actionable, so it is a pill beside the amount rather
 * than a line of prose underneath — a reader scanning the page for what is due should not
 * have to read a sentence to find out when.
 */
export function RequirementBlock({ finding }: { finding: RequirementFinding }) {
  return (
    <div className={RHYTHM.tight}>
      <div className={TYPE.label}>{finding.purpose}</div>
      <div className="flex flex-wrap items-baseline gap-[10px]">
        <span className={TYPE.figureSm}>{finding.amount}</span>
        {finding.deadline ? <span className={pill("neutral")}>{finding.deadline}</span> : null}
      </div>
      {finding.note ? <Detail text={finding.note} /> : null}
    </div>
  );
}

/* ----------------------------------------------------------- recommendation */

/**
 * Do this, because.
 *
 * The action is set off below the rationale in the accent ink rather than boxed as a
 * button: the report cannot perform it, and drawing a control the reader can press and
 * nothing happens is worse than stating the next step plainly.
 */
export function RecommendationBlock({ finding, index }: { finding: RecommendationFinding; index?: number }) {
  const hex = SEVERITY.info.hex;
  return (
    <Called
      hex={hex}
      title={finding.title}
      lead={
        index === undefined ? undefined : (
          <span className="font-satoshi text-[10px] font-bold tabular-nums text-black/30">
            {String(index + 1).padStart(2, "0")}
          </span>
        )
      }
      word="Recommended"
    >
      {finding.rationale ? <Detail text={finding.rationale} /> : null}
      {finding.action ? (
        <div className="mt-[8px] font-satoshi text-[13px] font-semibold leading-[1.45]" style={{ color: hex }}>
          {finding.action}
        </div>
      ) : null}
    </Called>
  );
}

/* ---------------------------------------------------------------- checklist */

/**
 * What is left, as a numbered set of decisions in two columns.
 *
 * The hairlined single column this replaces read as a schedule, which is the wrong shape for
 * the thing it holds: these are the actions the report is asking for, they are the last
 * thing on the page, and a reader arriving at them wants to count them. Numbered circles in
 * two columns do that; a tick box did the opposite, because a tick box nobody can tick
 * implies a state the report cannot actually change.
 *
 * `done` still shows a tick, because there the state is a fact the analysis recorded rather
 * than an affordance. Owner and due date sit under the text, which is where a second line
 * belongs once the row is half as wide.
 */
export function ChecklistBlock({ finding }: { finding: ChecklistFinding }) {
  return (
    <Block title={finding.label}>
      <ol className="m-0 grid list-none grid-cols-1 gap-x-[28px] gap-y-[2px] p-0 sm:grid-cols-2">
        {finding.items.map((item, index) => {
          const done = item.state === "done";
          const note = [item.owner, item.due].filter(Boolean).join(" · ");
          return (
            <li key={`${item.text}:${index}`} className="flex items-start gap-[12px] py-[10px]">
              <span
                className={`mt-[1px] grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border font-satoshi text-[11px] font-bold tabular-nums leading-none ${
                  done ? "border-transparent bg-[#1F6F4A] text-white" : "border-black/15 text-black/45"
                }`}
              >
                {done ? "✓" : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`${TYPE.cell} block font-medium ${done ? "text-black/45" : ""}`}>
                  {emphasise(item.text)}
                </span>
                {note ? <span className={`${TYPE.caption} mt-[2px] block`}>{note}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </Block>
  );
}

/* ---------------------------------------------------------------- narrative */

/**
 * A paragraph, with the changes it refers to pulled out as chips above it.
 *
 * The chips are the finding's own `deltas`, pre-formatted by the analysis. They sit above
 * the prose rather than inside it because a reader scanning for direction should get it
 * without reading the sentence, and a reader who reads the sentence gets it there too.
 */
export function NarrativeBlock({ finding, lead = false }: { finding: NarrativeFinding; lead?: boolean }) {
  const body = lead ? TYPE.bodyLead : TYPE.body;
  return (
    <Block title={finding.heading}>
      {finding.deltas && finding.deltas.length > 0 ? (
        <div className="flex flex-wrap gap-[6px]">
          {finding.deltas.map((delta, index) => (
            <span key={index} className={pill(toneOf(delta.value, delta.sentiment))}>
              {delta.label}
            </span>
          ))}
        </div>
      ) : null}
      <div>
        {finding.text.split(/\n{2,}/).map((para, index) => (
          <p key={index} className={`${body} ${index === 0 ? "m-0" : "mt-[12px] mb-0"}`}>
            {emphasise(para)}
          </p>
        ))}
      </div>
    </Block>
  );
}
