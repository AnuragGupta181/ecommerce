/** Calendar days ("YYYY-MM-DD") ↔ Postgres DATE columns, which Prisma reads as UTC midnight. */
export const toDbDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const fromDbDate = (date: Date) => date.toISOString().slice(0, 10);
