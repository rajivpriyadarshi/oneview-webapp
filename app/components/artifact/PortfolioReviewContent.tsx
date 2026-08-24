import type {
  WealthFamilySnapshotGroupedChange,
  WealthFamilySnapshotPayload,
  WealthFamilySnapshotTimelineChange,
} from "../../types/artifactTypes";
import { formatMoney, formatChange } from "../../utils/artifactFormatters";

function hasItemsChange(change: NonNullable<WealthFamilySnapshotPayload["changes"]>[number]): change is WealthFamilySnapshotGroupedChange {
  return "items" in change && Array.isArray(change.items);
}

function isTimelineChange(change: NonNullable<WealthFamilySnapshotPayload["changes"]>[number]): change is WealthFamilySnapshotTimelineChange {
  return !hasItemsChange(change);
}

function getTimelineChanges(payload: WealthFamilySnapshotPayload): WealthFamilySnapshotTimelineChange[] {
  return (payload.changes ?? []).filter(isTimelineChange);
}

function getGroupedChanges(payload: WealthFamilySnapshotPayload): WealthFamilySnapshotGroupedChange[] {
  return (payload.changes ?? []).filter(hasItemsChange);
}

export default function PortfolioReviewContent({ payload }: { payload: WealthFamilySnapshotPayload }) {
  const groupedChanges = getGroupedChanges(payload);
  const timelineChanges = getTimelineChanges(payload);
  const followUps = (payload.followUps ?? []).filter((item) => item.text);
  const discussionPoints = payload.discussionPoints ?? [];

  return (
    <>
      {/* Header */}
      <h1 className="mb-[8px] font-serif text-[28px] font-normal leading-[1.1] text-black">
        Meeting Preparation
      </h1>

      {payload.subject && (
        <div className="mb-[24px] font-satoshi">
          {payload.subject.name ? (
            <p className="text-[18px] font-semibold text-black">{payload.subject.name}</p>
          ) : null}
          {payload.subject.summary ? (
            <p className="mt-[4px] text-[13px] leading-[18px] text-black/60">{payload.subject.summary}</p>
          ) : null}
          {payload.subject.portfolio_value !== undefined && payload.subject.portfolio_value !== null ? (
            <p className="mt-[10px] text-[18px] font-medium text-black">
              {formatMoney(payload.subject.portfolio_value, payload.subject.currency)}
              {payload.subject.change !== undefined && payload.subject.change !== null && (
                <span className="ml-[8px] text-[14px] font-normal text-black/60">
                  {formatChange(payload.subject.change, payload.subject.change_pct)}
                </span>
              )}
            </p>
          ) : null}
        </div>
      )}

      {payload.lastMeeting ? (
        <section className="mb-[24px]">
          <h2 className="mb-[12px] font-satoshi text-[16px] font-bold text-black">
            Last meeting
          </h2>
          <div className="rounded-[12px] border border-black/10 bg-white/65 p-[14px]">
            <div className="mb-[8px] flex flex-wrap items-center gap-[8px] font-satoshi">
              {payload.lastMeeting.date ? (
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-black/45">
                  {payload.lastMeeting.date}
                </span>
              ) : null}
              {payload.lastMeeting.subject ? (
                <span className="text-[14px] font-semibold text-black/85">{payload.lastMeeting.subject}</span>
              ) : null}
            </div>
            {(payload.lastMeeting.points ?? []).length > 0 ? (
              <ul className="list-disc pl-[20px]">
                {(payload.lastMeeting.points ?? []).map((point, i) => (
                  <li key={i} className="mb-[4px] font-satoshi text-[13px] leading-[18px] text-black/70">
                    {point}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Near-term focus */}
      {payload.nearTermFocus && payload.nearTermFocus.length > 0 && (
        <section className="mb-[24px]">
          <h2 className="mb-[12px] font-satoshi text-[16px] font-bold text-black">
            Near-term focus
          </h2>
          <ul className="list-disc pl-[20px]">
            {payload.nearTermFocus.map((item, i) => (
              <li key={i} className="mb-[4px] font-satoshi text-[13px] leading-[18px] text-black/70">
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Performance summary */}
      {payload.performanceSummary && payload.performanceSummary.length > 0 && (
        <section className="mb-[24px]">
          <h2 className="mb-[12px] font-satoshi text-[16px] font-bold text-black">
            Performance summary
          </h2>
          <ul className="list-disc pl-[20px]">
            {payload.performanceSummary.map((item, i) => (
              <li key={i} className="mb-[4px] font-satoshi text-[13px] leading-[18px] text-black/70">
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* What changed since last review? */}
      {groupedChanges.length > 0 && (
        <section className="mb-[24px]">
          <h2 className="mb-[12px] font-satoshi text-[16px] font-bold text-black">
            What changed since last review?
          </h2>
          {groupedChanges.map((change, i) => (
            <div key={i} className="mb-[16px]">
              <h3 className="mb-[8px] font-satoshi text-[14px] font-semibold text-black/80">
                {change.category}
              </h3>
              <ul className="list-disc pl-[20px]">
                {change.items.map((item, j) => (
                  <li key={j} className="mb-[4px] font-satoshi text-[13px] leading-[18px] text-black/70">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {timelineChanges.length > 0 && (
        <section className="mb-[24px]">
          <h2 className="mb-[12px] font-satoshi text-[16px] font-bold text-black">
            Recent activity
          </h2>
          <div className="grid gap-[10px]">
            {timelineChanges.map((change, i) => (
              <div key={`${change.title ?? "activity"}-${i}`} className="rounded-[12px] border border-black/10 bg-white/65 p-[14px] font-satoshi">
                <div className="mb-[6px] flex flex-wrap items-center gap-[8px]">
                  {change.date ? (
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-black/45">
                      {change.date}
                    </span>
                  ) : null}
                  {change.type ? (
                    <span className="rounded-full bg-black/[0.06] px-[8px] py-[3px] text-[11px] font-semibold text-black/55">
                      {change.type}
                    </span>
                  ) : null}
                </div>
                {change.title ? (
                  <p className="text-[14px] font-semibold leading-[18px] text-black/85">{change.title}</p>
                ) : null}
                {change.subtitle ? (
                  <p className="mt-[4px] text-[12px] leading-[16px] text-black/55">{change.subtitle}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}

      {followUps.length > 0 && (
        <section className="mb-[24px]">
          <h2 className="mb-[12px] font-satoshi text-[16px] font-bold text-black">
            Follow-ups
          </h2>
          <ul className="space-y-[8px]">
            {followUps.map((item, i) => (
              <li key={i} className="flex gap-[10px] font-satoshi text-[13px] leading-[18px] text-black/70">
                <span className={`mt-[2px] grid h-[16px] w-[16px] shrink-0 place-items-center rounded-full border text-[10px] ${item.done ? "border-[#0e5f5b] bg-[#0e5f5b] text-white" : "border-black/18 bg-white/60 text-transparent"}`}>
                  ✓
                </span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {discussionPoints.length > 0 && (
        <section className="mb-[24px]">
          <h2 className="mb-[12px] font-satoshi text-[16px] font-bold text-black">
            Discussion points
          </h2>
          <ul className="list-disc pl-[20px]">
            {discussionPoints.map((item, i) => (
              <li key={i} className="mb-[4px] font-satoshi text-[13px] leading-[18px] text-black/70">
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Priorities & recommendations */}
      {payload.priorities && payload.priorities.length > 0 && (
        <section className="mb-[24px]">
          <h2 className="mb-[12px] font-satoshi text-[16px] font-bold text-black">
            Priorities & recommendations
          </h2>
          <ul className="list-disc pl-[20px]">
            {payload.priorities.map((item, i) => (
              <li key={i} className="mb-[4px] font-satoshi text-[13px] leading-[18px] text-black/70">
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Action items */}
      {payload.actionItems && payload.actionItems.length > 0 && (
        <section className="mb-[24px]">
          <h2 className="mb-[12px] font-satoshi text-[16px] font-bold text-black">
            Action items
          </h2>
          <ul className="list-disc pl-[20px]">
            {payload.actionItems.map((item, i) => (
              <li key={i} className="mb-[4px] font-satoshi text-[13px] leading-[18px] text-black/70">
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
