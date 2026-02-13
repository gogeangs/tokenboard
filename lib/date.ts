export function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function formatMonth(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

export function monthRange(month: string): { start: Date; endExclusive: Date } {
  const [year, monthPart] = month.split("-").map(Number);
  if (!year || !monthPart) {
    throw new Error("Invalid month format");
  }
  const start = new Date(Date.UTC(year, monthPart - 1, 1));
  const endExclusive = new Date(Date.UTC(year, monthPart, 1));
  return { start, endExclusive };
}

export function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}
