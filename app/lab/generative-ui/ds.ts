/**
 * The presentation scale. One place that decides what anything looks like.
 *
 * This file exists because of a specific failure. Every component in this prototype
 * was choosing its own type size, its own border and its own padding inline —
 * `text-[13px]` here, `text-[12px]` two lines down, `rounded-[10px] border
 * border-black/8 bg-white/50` on six different leaves. Each choice was defensible and
 * the aggregate was noise: a page of competing boxes with no rhythm, which is exactly
 * what a generated view cannot afford. When a human lays out one report they hold the
 * whole page in their head. A composer assembling components it has never seen
 * together cannot, so consistency has to come from the components being incapable of
 * disagreeing.
 *
 * So: no component below this file names a pixel size, a weight, or an opacity again.
 * They name a *role* — `TYPE.sectionTitle`, `TONE.positive`, `RHYTHM.block` — and this
 * file decides what the role means. That is the same discipline the brief applies to
 * the model ("semantic presentation, not visual styling"); it turns out the components
 * need it for the same reason.
 *
 * The scale is deliberately small. Four type sizes for text, two for figures, three
 * tones, three rhythms. A restricted palette of decisions is what makes independently
 * composed blocks look like one document.
 */

/* --------------------------------------------------------------------- palette */

/**
 * Oneview Threads' palette, transcribed from that project's design.md.
 *
 * Literal hexes rather than `var(--gu-*)`, and the duplication with ./ui/theme.css is
 * deliberate: several roles here build a tint by suffixing an alpha pair onto the hex
 * (`${SEVERITY.warn.hex}14`), and `var(--gu-ai)14` is not a colour. The shadcn primitives
 * need the variables; this file needs the values. `__tests__/palette.test.ts` fails if the
 * two ever disagree, which is the only way a split like this stays honest.
 *
 * Nothing outside this file names a colour. Everything below names a role.
 */
export const PALETTE = {
  /** The page the document sits on. Warm linen. */
  shell: "#f4f2ed",
  /** The document's own surface. */
  card: "#fffefa",
  /** Primary text. */
  ink: "#20211f",
  /** Running prose, a step lighter than a heading. */
  body: "#52525b",
  /** Captions, labels, column headers. */
  muted: "#6e706b",
  /** Timestamps and metadata — the quietest ink in the set. */
  meta: "#71717a",
  /** Dark fills: a tooltip, a filled tick box. */
  fill: "#252722",
  onFill: "#fffefa",
  /** Subtle fills, and the ink that sits on them. */
  subtle: "#eeece6",
  onSubtle: "#2a2b28",
  /** A de-emphasised surface — a callout, an inset band. */
  surface: "#f1efe9",
  /** Dividers, and the slightly stronger line an input takes. */
  border: "#dedbd2",
  line: "#d7d4cb",
  /** Generated: the amber that marks something a machine wrote. */
  ai: "#8b6534",
  aiSurface: "#faf5eb",
  aiBorder: "#ebdcc2",
  /** Went the client's way. */
  ok: "#246e45",
  okSurface: "#edf6f0",
  okBorder: "#c4e3cf",
  /** Did not. */
  bad: "#a94739",
  /** Stated for the record rather than flagged. */
  note: "#4d5c70",
  /** 0.65rem, as one number for the whole document. */
  radius: "10px",
} as const;

/* ------------------------------------------------------------------ typography */

/**
 * Six roles, and every one of them is load-bearing somewhere.
 *
 * `docTitle` is serif and everything else is sans. That is the one typeface contrast
 * in the document and it does real work: it marks the title as the title without
 * needing size alone to carry it, which is what lets `sectionTitle` be quiet.
 */
export const TYPE = {
  /**
   * The report's name. Serif, because it is the only thing at this level.
   *
   * Butler Medium with the Overview page's tight tracking, which is the face the app
   * already sets a client's name in — a report about Prashanth and the Overview tab's
   * header of Prashanth should not be two different typefaces one tab apart. Only the ink
   * differs: the report keeps the document's near-black rather than the Overview's brown.
   */
  docTitle: "font-butler-medium text-[32px] leading-[1.1] tracking-[-0.034em] text-[#20211f]",
  /** One line under the title saying what the report is for. */
  docSubtitle: "font-satoshi text-[16px] leading-[1.5] text-[#6e706b]",

  /**
   * A section's name — "What changed?".
   *
   * The second-largest thing on the page, and the spine of the document. The earlier scale
   * had one heading role for both a section and a block inside it, which is why the report
   * scanned as a long undifferentiated list: nine headings at 15px semibold, each equally
   * likely to be the next thing you should read. A reader needs to see the spine from
   * across the room and the joints within a section up close, and those are two roles.
   *
   * Sans at 600 rather than serif: the serif title at the top of the page is the one
   * typeface contrast the document makes, and repeating it seven times down the page spent
   * that contrast on the furniture. Weight carries a heading at this size on its own — and
   * at 18px it does so without the heading needing to be a third of the way to the title.
   */
  areaTitle: "font-satoshi text-[18px] font-semibold leading-[1.3] tracking-[-0.015em] text-[#20211f]",
  /** One line under a section heading, saying what the section is about. */
  areaCaption: "font-satoshi text-[14px] leading-[1.5] text-[#6e706b]",

  /**
   * A block's name — "Executive summary", "Portfolio allocation".
   *
   * Semibold at body size rather than large: a heading earns attention by weight and
   * by the space above it, and using size for eight headings on one page produces a
   * document that shouts in eight places.
   */
  sectionTitle: "font-satoshi text-[15px] font-semibold leading-[1.4] text-[#20211f]",
  /** An optional line under a block title. */
  sectionCaption: "font-satoshi text-[13px] leading-[1.5] text-[#6e706b]",

  /**
   * Running prose. Every passage in the document, at one size.
   *
   * 14px at 1.65 — the leading is what does the work here, not the size. The earlier scale
   * ran three sizes for prose (16 lead / 15 body / 13 note) on the reasoning that a lead
   * should look like a lead; at one and two pixels apart that is not a hierarchy, it reads
   * as inconsistency, and it made the document's first paragraph the largest thing on the
   * page after the title.
   */
  body: "font-satoshi text-[14px] leading-[1.65] text-[#52525b]",
  /**
   * The lead paragraph — the readout, and the takeaway beside it.
   *
   * Deliberately the same size as `body`, and kept as its own role because the *place* is
   * still distinct: what marks the opening is the wash, the mark and the measure, none of
   * which any other passage gets. Having the role means that can change without every
   * caller changing with it.
   */
  bodyLead: "font-satoshi text-[14px] leading-[1.65] text-[#52525b]",

  /**
   * A label above a figure, or a table header.
   *
   * Sentence case, not the uppercase micro-label this prototype used everywhere.
   * Uppercase tracking is a device for one or two labels on a page; at the density a
   * generated report reaches it turns every caption into furniture.
   */
  label: "font-satoshi text-[13px] leading-[1.4] text-[#6e706b]",
  /** Beneath a figure: what it is measured against. */
  caption: "font-satoshi text-[13px] leading-[1.45] text-[#6e706b]",

  /** A headline figure. */
  figure: "font-satoshi text-[32px] font-medium leading-[1.05] tracking-[-0.02em] tabular-nums text-[#20211f]",
  /** A figure in a strip of peers, or inside a block. */
  figureSm: "font-satoshi text-[20px] font-medium leading-[1.1] tracking-[-0.01em] tabular-nums text-[#20211f]",

  /** Table text. Tabular figures, because a column of numbers has to align. */
  cell: "font-satoshi text-[14px] leading-[1.5] text-[#20211f]",
  cellMuted: "font-satoshi text-[14px] leading-[1.5] text-[#6e706b]",
} as const;

/* ------------------------------------------------------------------- sentiment */

/**
 * The three tones, and the only colour any component is allowed to choose.
 *
 * Colour here is never decoration. Green and red in a financial report are claims —
 * "this went the client's way", "this did not" — so the tone is derived from the
 * finding's own `sentiment` or the sign of its value, never from a prop. A composer
 * that could set the tone could make a loss look like a gain without touching the
 * number, which is precisely the class of thing §9 forbids.
 */
export const TONE = {
  positive: { text: "text-[#246e45]", bg: "bg-[#edf6f0]", hex: PALETTE.ok },
  negative: { text: "text-[#a94739]", bg: "bg-[#a94739]/10", hex: PALETTE.bad },
  neutral: { text: "text-[#6e706b]", bg: "bg-[#eeece6]", hex: PALETTE.muted },
} as const;

export type ToneName = keyof typeof TONE;

/**
 * The three severities, as a word and an ink.
 *
 * Here rather than in a component because severity is a *semantic* field — layer 3 sets
 * it — and how loudly the document says each level has to be one decision. The old
 * treatment filled a rounded box with peach at every level, which made an informational
 * note look like an emergency and gave the page two large tinted rectangles competing
 * with the prose between them. An ink and a rule are enough: the reader's eye finds the
 * accent, and the word says which kind it is.
 *
 * `word` is a rendering of the enum, not new content. Nothing here can change what was
 * flagged or how serious the analysis said it was.
 */
export const SEVERITY = {
  info: { word: "Note", hex: PALETTE.note },
  warn: { word: "Needs attention", hex: PALETTE.ai },
  critical: { word: "Critical", hex: PALETTE.bad },
} as const;

export type SeverityName = keyof typeof SEVERITY;

/** The emphasised bar / series colour, and the grey everything else sits in. */
export const CHART = {
  /** One series is the subject. It gets the ink. */
  primary: PALETTE.ok,
  /** The rest are context. The divider grey, so the subject is unambiguous. */
  context: PALETTE.border,
  /** A target or benchmark band behind the subject. */
  reference: PALETTE.subtle,
} as const;

/* ---------------------------------------------------------------------- rhythm */

/**
 * Vertical space, which is what actually makes a document readable.
 *
 * Three steps only. The important one is `section`: 40px between blocks is what
 * separates "a document with sections" from "a stack of cards", and it is the single
 * change that does most of the work in making composed output look deliberate.
 */
export const RHYTHM = {
  /** Between top-level blocks. */
  section: "space-y-[40px]",
  /** Between elements inside one block. */
  block: "space-y-[16px]",
  /** Between lines of one element. */
  tight: "space-y-[8px]",
} as const;

/* -------------------------------------------------------------------- surfaces */

/**
 * Almost nothing is a card.
 *
 * The prototype's default was a bordered translucent panel per component, so a report
 * with nine findings rendered as nine boxes and the reader got no signal about which
 * mattered. A box should mean something — here it means "this is a discrete figure you
 * should be able to scan against its peers", which is true of a metric tile and false
 * of a paragraph, a table, or a chart. Those sit flat on the page.
 */
export const SURFACE = {
  /** A metric tile. The only routinely boxed thing in the document. */
  tile: "rounded-[10px] border border-[#dedbd2] bg-[#fffefa] px-[16px] py-[14px]",
  /**
   * A chart, a table, a schedule: something with its own internal geometry.
   *
   * The earlier version of this document had no panel at all, on the reasoning that a
   * page of boxes has no hierarchy. True, and it overcorrected: a chart *is* a bounded
   * object — it has axes, a plot area and a legend, and letting that bleed into the
   * page's own margins makes it read as a stain rather than a figure. So a panel is for
   * things with edges of their own, and prose, callouts and headings stay flat. What the
   * page must never become is a panel per finding.
   */
  panel: "rounded-[10px] border border-[#dedbd2] bg-[#fffefa] px-[18px] py-[16px]",
  /** A callout that has to be noticed — a flag, a recommendation. Tinted, not boxed. */
  inset: "rounded-[10px] border border-[#dedbd2] bg-[#f1efe9] px-[16px] py-[14px]",
  /** One hairline. Used for table rows and under a section title. */
  hairline: "border-[#dedbd2]",
  /**
   * The one band on the page that says a machine wrote it — the readout.
   *
   * Amber rather than green, which is the correction design.md makes to what was here: the
   * opening passage was washed in the positive tone, so the document's loudest signal for
   * "this went the client's way" was spent on a panel that is simply generated text. Green
   * now means only the claim. Amber means authorship.
   */
  generated: "rounded-[10px] border border-[#ebdcc2] bg-[#faf5eb]",
} as const;

/** A tinted pill: a delta beside a figure, a severity beside a risk. */
export const pill = (tone: ToneName): string =>
  `inline-flex items-center rounded-[6px] px-[6px] py-[2px] font-satoshi text-[12px] font-medium tabular-nums ${TONE[tone].bg} ${TONE[tone].text}`;

/**
 * A tone from a signed number, which is the honest source for it.
 *
 * Takes `sentiment` when the analysis stated one, because "up" and "good" are not the
 * same thing — a rising cost and a rising return both have a positive sign and opposite
 * meanings, and only layer 3 knows which.
 */
export const toneOf = (
  value: number | undefined,
  sentiment?: "positive" | "negative" | "neutral",
): ToneName => {
  if (sentiment) return sentiment;
  if (value === undefined || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
};
