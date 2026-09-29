const DMY = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** Shape typed digits into dd/mm/yyyy. Slashes appear once the next part starts. */
export function maskDmy(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  if (digits.length <= 2) return day;
  if (digits.length <= 4) return `${day}/${month}`;
  return `${day}/${month}/${year}`;
}

/** Parse a complete dd/mm/yyyy value into YYYY-MM-DD, or null when it is not a real calendar date. */
export function dmyToIso(value: string): string | null {
  const match = DMY.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10) === iso ? iso : null;
}
