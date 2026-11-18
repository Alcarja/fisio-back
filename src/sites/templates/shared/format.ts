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

// "Fisio Demo Valencia" → "FD" (monogram when there's no logo or photo)
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-ZÁÉÍÓÚÑ]/.test(w))
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("") || name.charAt(0).toUpperCase();

// The first sentence of a text (pull quotes)
export function firstSentence(text: string | undefined) {
  const t = (text ?? "").trim();
  const match = t.match(/^(.+?[.!?])(\s|$)/);
  return match ? match[1]! : t;
}

// ---------- Open now ----------

const SHORT_DAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

// The weekday (1 = Monday) and "HH:MM" in Spain right now. Pages are cached
// for 60 s, so the status is at most a minute late
export function spainNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { weekday: SHORT_DAYS[get("weekday")] ?? 1, time: `${get("hour")}:${get("minute")}` };
}

// "Abierto · hasta las 14:00", "Cerrado · abrimos a las 16:00", "… mañana a
// las 9:00", "… el lunes a las 9:00". null without opening hours
export function openStatus(hours: SiteHours[], now = spainNow()): { open: boolean; label: string } | null {
  if (!hours.length) return null;
  const short = (t: string) => t.replace(/^0(\d)/, "$1");
  const today = hours.filter((h) => h.weekday === now.weekday).sort((a, b) => a.start.localeCompare(b.start));
  const current = today.find((h) => h.start <= now.time && now.time < h.end);
  if (current) return { open: true, label: `Abierto · hasta las ${short(current.end)}` };
  const later = today.find((h) => h.start > now.time);
  if (later) return { open: false, label: `Cerrado · abrimos a las ${short(later.start)}` };
  for (let i = 1; i <= 7; i++) {
    const day = ((now.weekday - 1 + i) % 7) + 1;
    const first = hours.filter((h) => h.weekday === day).sort((a, b) => a.start.localeCompare(b.start))[0];
    if (first) {
      const when = i === 1 ? "mañana" : `el ${WEEKDAYS[day - 1]!.toLowerCase()}`;
      return { open: false, label: `Cerrado · abrimos ${when} a las ${short(first.start)}` };
    }
  }
  return null;
}
