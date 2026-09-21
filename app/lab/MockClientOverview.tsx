/**
 * The client overview panel, as the labs show it.
 *
 * Every prototype under /lab is the *same* screen with a different chat
 * behaviour, so this panel is shared between them rather than re-mocked per
 * prototype — a lab that draws its own overview would drift from the others and
 * make two prototypes look like two products.
 *
 * A mock on purpose: no redux, no api, nothing to authenticate. `children` is an
 * overlay slot, for a prototype that opens something over this panel the way
 * meeting notes do today.
 *
 * `client` is a prop now, and it had to become one. The generative-ui lab can switch
 * which client it is simulating, and with the panel hardcoded the switch produced the
 * worst possible screen: Eleanor's report open over Prashanth's name, segment and AUM.
 * Two clients on one page is not a cosmetic bug — every figure on it looks plausible. The
 * default is the same content as before, so the other two labs are unchanged.
 */

export type ClientOverview = {
  name: string;
  summary: string;
  location: string;
  aum: string;
  aumDelta?: string;
  /** Label / value pairs, in the order they should read. */
  glance: [string, string][];
};

const DEFAULT_CLIENT: ClientOverview = {
  name: "Prashanth Kumar",
  summary:
    "Singapore-based family office with concentrated technology equity, private investments, trust structures and multi-currency exposure.",
  location: "Singapore",
  aum: "$33.3 M",
  aumDelta: "↗ +3.8%",
  glance: [
    ["Segment", "Family office"],
    ["Client since", "2016"],
    ["Family", "4 members"],
    ["Tax residency", "Singapore"],
    ["Risk profile", "Growth"],
  ],
};

export default function MockClientOverview({
  children,
  client = DEFAULT_CLIENT,
}: {
  children?: React.ReactNode;
  client?: ClientOverview;
}) {
  return (
    <section
      className="relative grid h-screen min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-[#F9F8F7]"
      aria-label="Client overview (mock)"
    >
      <header className="flex h-[54px] items-center gap-2 border-b border-black/10 bg-white/70 px-4 backdrop-blur-[12px]">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#432411] px-4 py-2 font-satoshi text-[13px] font-medium text-white">
          Overview
        </span>
        <span className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-satoshi text-[13px] text-black/60">
          Wealth map
        </span>
        <span className="ml-auto rounded-full bg-black/5 px-3 py-1 font-satoshi text-[11px] text-black/40">
          mock — not wired
        </span>
      </header>

      <div className="overflow-y-auto px-[40px] py-[36px]">
        <h1 className="m-0 font-butler-medium text-[44px] leading-[1.1] tracking-[-1.5px] text-[#432411]">
          {client.name}
        </h1>
        <p className="mt-3 max-w-[520px] font-satoshi text-[15px] leading-[24px] text-black/60">
          {client.summary}
        </p>
        <span className="mt-4 inline-flex rounded-full bg-black/[0.06] px-4 py-2 font-satoshi text-[13px] font-medium text-[#171615]">
          {client.location}
        </span>

        <div className="mt-8 max-w-[520px] rounded-[24px] bg-white p-[28px] shadow-[0_2px_20px_rgba(0,0,0,0.04)]">
          <p className="m-0 font-satoshi text-[13px] font-bold tracking-[0.08em] uppercase text-[#804D13]">AUM</p>
          <p className="mt-2 mb-0 flex items-baseline gap-3 font-satoshi text-[40px] font-bold tracking-[-1px] text-[#171615]">
            {client.aum}
            {client.aumDelta ? (
              <span className="font-satoshi text-[15px] font-medium text-[#1a7f4b]">{client.aumDelta}</span>
            ) : null}
          </p>

          <p className="mt-7 mb-0 font-satoshi text-[12px] font-bold tracking-[0.08em] uppercase text-black/40">
            At a glance
          </p>
          <dl className="m-0 mt-2">
            {client.glance.map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between border-b border-black/[0.07] py-[14px] last:border-b-0"
              >
                <dt className="font-satoshi text-[15px] text-black/70">{key}</dt>
                <dd className="m-0 font-satoshi text-[15px] font-medium text-[#171615]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {children}
    </section>
  );
}
