/**
 * Instrument marks — a logo per ticker, for the figures that are about one security.
 *
 * Why a table rather than a lookup service: a mark is an *asset*, and a document that
 * fetches one per position at render time either flickers or leaks the holdings to whoever
 * hosts the images. So the file is local, the mapping is explicit, and a symbol nobody has
 * an asset for renders with no mark at all — which is the honest outcome, and the reason
 * every caller treats the mark as optional.
 *
 * What a mark must never do is carry information. It identifies the instrument the figure
 * already names; it does not say the position is good, large, or worth acting on. That is
 * why there is no colour or size here — only the file and the name it stands for.
 */

export type InstrumentMark = {
  /** Path under /public. */
  src: string;
  /** The issuer's name, for the alt text. */
  name: string;
};

export const INSTRUMENT_MARKS: Record<string, InstrumentMark> = {
  NVDA: { src: "/marks/nvda.svg", name: "NVIDIA" },
};

/** The mark for a ticker, if there is one. Case-insensitive; absent is normal. */
export const markFor = (symbol: string | undefined): InstrumentMark | undefined =>
  symbol ? INSTRUMENT_MARKS[symbol.trim().toUpperCase()] : undefined;
