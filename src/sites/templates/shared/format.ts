import type { SiteHours } from "../types.js";

// Small helpers shared by every template

const price = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

// 4550 → "45,50 €" (no decimals when round: "45 €")
export const formatPrice = (cents: number) =>
  price.format(cents / 100).replace(/,00\s/, " ");

// 90 → "1 h 30 min"
export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
// schema.org names, for Google
export const SCHEMA_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// One row per day, Monday to Sunday: its time ranges, or none (closed)
export function hoursByDay(hours: SiteHours[]) {
  return WEEKDAYS.map((label, i) => ({
    label,
    ranges: hours.filter((h) => h.weekday === i + 1).map((h) => `${h.start}–${h.end}`),
  }));
}

// Plain text → paragraphs (one per line break)
export const paragraphs = (text: string | undefined) =>
  (text ?? "")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

// "+34 600 00 00 00" → "+34600000000" for tel: links
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

// WhatsApp needs the full number without "+": Spanish numbers get 34 in front
export function whatsappHref(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (!phone.trim().startsWith("+") && digits.length === 9) digits = `34${digits}`;
  return `https://wa.me/${digits}`;
}

// The address on one line
export function fullAddress(c: { address?: string; postalCode?: string; city?: string }) {
  const place = [c.postalCode, c.city].filter(Boolean).join(" ");
  return [c.address, place].filter(Boolean).join(", ");
}
