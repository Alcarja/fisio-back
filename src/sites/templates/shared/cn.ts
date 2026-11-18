import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// The same cn() as shadcn/ui in the front: joins classes and lets later
// Tailwind classes override earlier ones (cn("p-4", "p-6") → "p-6")
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
