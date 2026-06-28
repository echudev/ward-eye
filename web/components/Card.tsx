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
    <section
      className={`rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 ${className ?? ""}`}
    >
      {title && (
        <header className="mb-3">
          <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
          {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
