import type { ComponentProps, ReactNode } from "react";

// shadcn/ui for the clinic sites. The same components, variants and design
// tokens as front/src/components/ui, rebuilt for pages that ship no
// JavaScript: no Tailwind, no Radix, plain classes styled by uiCss below.
// Interactive pieces use HTML that works on its own (Accordion = <details>).
//
// Tokens (each template sets them on :root): --background, --foreground,
// --card, --card-foreground, --muted, --muted-foreground, --border, --ring,
// --radius, --primary, --primary-foreground, --secondary,
// --secondary-foreground.

const cn = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

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

// ---------- Styles ----------

export const uiCss = `
.ui-icon{width:1rem;height:1rem;flex:none}

/* Button */
.ui-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;flex-shrink:0;white-space:nowrap;border-radius:calc(var(--radius) * .8);border:1px solid transparent;font-family:var(--font-body);font-size:.9rem;font-weight:500;line-height:1;text-decoration:none;cursor:pointer;user-select:none;transition:background-color .2s,color .2s,border-color .2s,box-shadow .2s,transform .1s;outline:none}
.ui-btn:focus-visible{border-color:var(--ring);box-shadow:0 0 0 3px color-mix(in srgb,var(--ring) 50%,transparent)}
.ui-btn:active{transform:translateY(1px)}
.ui-btn .ui-icon{transition:transform .2s}
.ui-btn:hover .ui-icon:last-child:not(:first-child){transform:translateX(2px)}
.ui-btn-size-default{height:2.5rem;padding:0 1rem}
.ui-btn-size-sm{height:2.15rem;padding:0 .85rem;font-size:.85rem;border-radius:calc(var(--radius) * .7)}
.ui-btn-size-lg{height:3rem;padding:0 1.4rem;font-size:.95rem}
.ui-btn-size-icon{width:2.5rem;height:2.5rem;padding:0}
.ui-btn-default{background:var(--primary);color:var(--primary-foreground)}
.ui-btn-default:hover{background:color-mix(in srgb,var(--primary) 86%,var(--foreground))}
.ui-btn-secondary{background:var(--secondary);color:var(--secondary-foreground)}
.ui-btn-secondary:hover{background:color-mix(in srgb,var(--secondary) 94%,var(--foreground))}
.ui-btn-outline{background:var(--background);color:var(--foreground);border-color:var(--border)}
.ui-btn-outline:hover{background:var(--muted)}
.ui-btn-ghost{background:transparent;color:var(--foreground)}
.ui-btn-ghost:hover{background:var(--muted)}
.ui-btn-link{background:none;color:var(--primary);padding-left:0;padding-right:0;height:auto;text-underline-offset:4px}
.ui-btn-link:hover{text-decoration:underline}

/* Badge */
.ui-badge{display:inline-flex;align-items:center;gap:.35rem;width:fit-content;height:1.5rem;padding:0 .6rem;border-radius:999px;border:1px solid transparent;font-size:.75rem;font-weight:500;white-space:nowrap;line-height:1}
.ui-badge .ui-icon,.ui-badge .icon{width:.8rem;height:.8rem}
.ui-badge-default{background:var(--primary);color:var(--primary-foreground)}
.ui-badge-secondary{background:var(--secondary);color:var(--secondary-foreground)}
.ui-badge-outline{border-color:var(--border);color:var(--foreground);background:var(--background)}

/* Card */
.ui-card{--card-spacing:1.5rem;display:flex;flex-direction:column;gap:var(--card-spacing);overflow:hidden;border-radius:calc(var(--radius) * 1.4);background:var(--card);color:var(--card-foreground);padding:var(--card-spacing) 0;box-shadow:0 0 0 1px color-mix(in srgb,var(--foreground) 9%,transparent)}
.ui-card[data-size=sm]{--card-spacing:1rem}
.ui-card:has(>[data-slot=card-footer]){padding-bottom:0}
.ui-card:has(>img:first-child){padding-top:0}
.ui-card-header{display:grid;grid-auto-rows:min-content;align-items:start;gap:.35rem;padding:0 var(--card-spacing)}
.ui-card-header:has(>[data-slot=card-action]){grid-template-columns:1fr auto}
.ui-card-title{margin:0;font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:1.15rem;line-height:1.3;color:var(--card-foreground)}
.ui-card-description{font-size:.92rem;color:var(--muted-foreground)}
.ui-card-description p{margin:0}
.ui-card-action{grid-column:2;grid-row:1 / span 2;align-self:start;justify-self:end}
.ui-card-content{padding:0 var(--card-spacing)}
.ui-card-footer{display:flex;align-items:center;gap:.5rem;border-top:1px solid var(--border);background:color-mix(in srgb,var(--muted) 50%,transparent);padding:calc(var(--card-spacing) * .75) var(--card-spacing);margin-top:auto}

/* Separator */
.ui-separator{flex-shrink:0;background:var(--border)}
.ui-separator[data-orientation=horizontal]{height:1px;width:100%}
.ui-separator[data-orientation=vertical]{width:1px;align-self:stretch}

/* Avatar */
.ui-avatar{position:relative;display:inline-flex;flex-shrink:0;overflow:hidden;border-radius:999px;width:2.5rem;height:2.5rem;background:var(--muted)}
.ui-avatar[data-size=sm]{width:2rem;height:2rem;font-size:.75rem}
.ui-avatar[data-size=lg]{width:3.5rem;height:3.5rem;font-size:1.1rem}
.ui-avatar-image{width:100%;height:100%;object-fit:cover}
.ui-avatar-fallback{display:flex;width:100%;height:100%;align-items:center;justify-content:center;color:var(--muted-foreground);font-weight:500;font-size:.85em}

/* Accordion */
.ui-accordion{display:flex;flex-direction:column}
.ui-accordion-item{border-bottom:1px solid var(--border)}
.ui-accordion-trigger{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;padding:1.15rem 0;cursor:pointer;list-style:none;font-weight:500;text-align:left;border-radius:calc(var(--radius) * .6);outline:none;transition:color .2s}
.ui-accordion-trigger::-webkit-details-marker{display:none}
.ui-accordion-trigger:hover{color:var(--primary)}
.ui-accordion-trigger:focus-visible{box-shadow:0 0 0 3px color-mix(in srgb,var(--ring) 50%,transparent)}
.ui-accordion-trigger .ui-chevron{margin-top:.25rem;color:var(--muted-foreground);transition:transform .25s}
.ui-accordion-item[open] .ui-chevron{transform:rotate(180deg)}
.ui-accordion-content{padding:0 2rem 1.25rem 0;color:var(--muted-foreground)}
.ui-accordion-content p{margin:0 0 .6rem}
.ui-accordion-content p:last-child{margin:0}
.ui-accordion-item[open] .ui-accordion-content{animation:ui-accordion-in .3s ease-out}
@keyframes ui-accordion-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}

/* Breadcrumb */
.ui-breadcrumb-list{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem;list-style:none;margin:0;padding:0;font-size:.875rem;color:var(--muted-foreground)}
.ui-breadcrumb-item{display:inline-flex;align-items:center;gap:.4rem}
.ui-breadcrumb-link{color:inherit;text-decoration:none;transition:color .2s}
.ui-breadcrumb-link:hover{color:var(--foreground)}
.ui-breadcrumb-page{color:var(--foreground)}
.ui-breadcrumb-separator .ui-icon{width:.85rem;height:.85rem}
`;
