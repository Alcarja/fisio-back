import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn.js";

// shadcn/ui for the clinic sites. The same components, variants and design
// tokens as front/src/components/ui, rebuilt for pages that ship no
// JavaScript: no Radix. Each part keeps a "ui-*" class (the hook templates
// use to restyle it); its look is written with shadcn's Tailwind utilities in
// the "ui" layer of src/sites/tailwind.css. Layers: ui < template CSS <
// Tailwind utilities, so a template can restyle a part and a Tailwind class
// in className always wins (cn = clsx + tailwind-merge).
// Interactive pieces use HTML that works on its own (Accordion = <details>).
//
// Tokens (each template sets them on :root): --background, --foreground,
// --card, --card-foreground, --muted, --muted-foreground, --border, --ring,
// --radius, --primary, --primary-foreground, --secondary,
// --secondary-foreground.



// ---------- Button ----------

type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon";

export const buttonVariants = ({ variant = "default", size = "default" }: { variant?: ButtonVariant; size?: ButtonSize } = {}) =>
  cn("ui-btn", `ui-btn-${variant}`, `ui-btn-size-${size}`);

// Always a link here: sites have no forms. `asChild` isn't needed
export function Button({
  variant = "default",
  size = "default",
  className,
  ...props
}: ComponentProps<"a"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <a
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

// ---------- Badge ----------

type BadgeVariant = "default" | "secondary" | "outline";

export function Badge({ variant = "default", className, ...props }: ComponentProps<"span"> & { variant?: BadgeVariant }) {
  return <span data-slot="badge" data-variant={variant} className={cn("ui-badge", `ui-badge-${variant}`, className)} {...props} />;
}

// ---------- Card ----------

export function Card({ className, size = "default", ...props }: ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return <div data-slot="card" data-size={size} className={cn("ui-card", className)} {...props} />;
}
export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("ui-card-header", className)} {...props} />;
}
export function CardTitle({ className, as: Tag = "h3", ...props }: ComponentProps<"h3"> & { as?: "h2" | "h3" | "div" }) {
  return <Tag data-slot="card-title" className={cn("ui-card-title", className)} {...props} />;
}
export function CardDescription({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-description" className={cn("ui-card-description", className)} {...props} />;
}
export function CardAction({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-action" className={cn("ui-card-action", className)} {...props} />;
}
export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("ui-card-content", className)} {...props} />;
}
export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("ui-card-footer", className)} {...props} />;
}

// ---------- Separator ----------

export function Separator({
  orientation = "horizontal",
  decorative = true,
  className,
}: {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
  className?: string;
}) {
  return (
    <div
      data-slot="separator"
      data-orientation={orientation}
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      className={cn("ui-separator", className)}
    />
  );
}

// ---------- Avatar ----------

export function Avatar({
  src,
  alt,
  fallback,
  size = "default",
  className,
}: {
  src?: string;
  alt: string;
  fallback: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  return (
    <span data-slot="avatar" data-size={size} className={cn("ui-avatar", className)}>
      {src ? (
        <img data-slot="avatar-image" src={src} alt={alt} loading="lazy" className="ui-avatar-image" />
      ) : (
        <span data-slot="avatar-fallback" className="ui-avatar-fallback" aria-hidden="true">
          {fallback}
        </span>
      )}
    </span>
  );
}

// ---------- Accordion (no JavaScript: <details>) ----------

export function Accordion({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="accordion" className={cn("ui-accordion", className)} {...props} />;
}

export function AccordionItem({
  title,
  children,
  name,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  // Same name on every item = only one open at a time (type="single")
  name?: string;
  className?: string;
}) {
  return (
    <details data-slot="accordion-item" className={cn("ui-accordion-item", className)} {...(name ? { name } : {})}>
      <summary data-slot="accordion-trigger" className="ui-accordion-trigger">
        <span>{title}</span>
        <ChevronDown />
      </summary>
      <div data-slot="accordion-content" className="ui-accordion-content">
        {children}
      </div>
    </details>
  );
}

// ---------- Breadcrumb ----------

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav data-slot="breadcrumb" aria-label="Ruta de navegación">
      <ol className="ui-breadcrumb-list">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="ui-breadcrumb-item">
              {last || !item.href ? (
                <span aria-current={last ? "page" : undefined} className="ui-breadcrumb-page">
                  {item.label}
                </span>
              ) : (
                <a href={item.href} className="ui-breadcrumb-link">
                  {item.label}
                </a>
              )}
              {!last && (
                <span className="ui-breadcrumb-separator" aria-hidden="true">
                  <ChevronRight />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ---------- Icons used by the components (Lucide, ISC) ----------

const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const ChevronDown = () => (
  <svg {...svg} className="ui-icon ui-chevron">
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const ChevronRight = () => (
  <svg {...svg} className="ui-icon">
    <path d="m9 18 6-6-6-6" />
  </svg>
);
export const ArrowRight = () => (
  <svg {...svg} className="ui-icon">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);
export const ArrowUpRight = () => (
  <svg {...svg} className="ui-icon">
    <path d="M7 17 17 7M7 7h10v10" />
  </svg>
);
export const MenuIcon = () => (
  <svg {...svg} className="ui-icon">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
