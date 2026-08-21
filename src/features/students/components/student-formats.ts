// How the student dashboard writes dates and numbers.
//
// One module rather than a copy per panel: the header, the homework list and the
// register all show dates, and three formatters drift into three house styles.
// The locale is left to the browser throughout, as it is everywhere else in the
// app — only the shape of each figure is a decision made here.

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const relativeFormat = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

/** A timestamp as a day. "—" for anything missing or unparseable. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateFormat.format(date);
}

/**
 * A `Date` as a day — the form for Postgres `date` columns, which `fromDateKey`
 * turns into a local calendar day first. Passing the raw "2026-08-14" through
 * {@link formatDate} instead would read it as UTC midnight, and print the day
 * before anywhere west of Greenwich.
 */
export function formatDay(date: Date): string {
  return Number.isNaN(date.getTime()) ? "—" : dateFormat.format(date);
}

/** A timestamp as a day and a time — used where the hour matters, such as when
 *  a homework landed. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormat.format(date);
}

/**
 * "3 days ago", "last month". Falls back to the date itself beyond a year,
 * where the relative form stops being the more useful of the two.
 */
export function formatSince(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const days = Math.round((date.getTime() - Date.now()) / 86_400_000);

  // `numeric: "auto"` turns the small counts into words — 0 is "today", -1 is
  // "yesterday" — which is why there is no special case for them here.
  if (Math.abs(days) < 30) return relativeFormat.format(days, "day");
  if (Math.abs(days) < 365) {
    return relativeFormat.format(Math.round(days / 30), "month");
  }
  return dateFormat.format(date);
}

/**
 * A mark out of ten, to one decimal — but only when it needs one. An average of
 * exactly 8 reads better as "8" than as "8.0", and a column of marks that mixes
 * the two is a column you stop scanning.
 */
export function formatMark(score: number | null): string {
  if (score === null) return "—";
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

/** A 0–1 share as a whole percentage. */
export function formatPercent(share: number | null): string {
  return share === null ? "—" : `${Math.round(share * 100)}%`;
}
