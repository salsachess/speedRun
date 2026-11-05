export function parseStartDate(value: unknown): Date {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === 'number' || typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  throw new Error(`Invalid start date: ${value}`);
}
