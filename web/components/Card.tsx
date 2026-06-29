import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface-card rounded-lg p-4 ${className ?? ""}`}>
      {title && (
        <header className="mb-3">
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-1 rounded-full bg-primary" />
            <h2 className="text-sm font-medium uppercase tracking-[0.1em] text-primary">
              {title}
            </h2>
          </div>
          {subtitle && (
            <p className="mt-0.5 pl-3 text-xs text-muted">{subtitle}</p>
          )}
        </header>
      )}
      {children}
    </section>
  );
}
