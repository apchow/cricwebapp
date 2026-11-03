const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Format an ISO timestamp without touching `Date` locale rules. Records are
 * saved as UTC strings, so slicing them keeps the server and client markup
 * identical and sidesteps a hydration mismatch.
 */
export function matchDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  const label = MONTHS[Number(month) - 1] ?? "";
  return `${Number(day)} ${label} ${year}`;
}
