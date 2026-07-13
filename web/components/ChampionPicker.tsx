"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ChampionOption } from "@/lib/types";

/**
 * Filtro global de campeón: escribe/borra `?champion=` en la URL. El page
 * (Server Component, `force-dynamic`) lee ese search param y re-consulta la
 * DB acotada a ese campeón, así que este picker no necesita estado propio.
 */
export function ChampionPicker({
  champions,
  selected,
}: {
  champions: ChampionOption[];
  selected: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("champion");
    } else {
      params.set("champion", value);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="champion-picker"
        className="text-[11px] uppercase tracking-[0.14em] text-secondary"
      >
        Campeón
      </label>
      <select
        id="champion-picker"
        value={selected ?? "all"}
        onChange={(e) => onChange(e.target.value)}
        disabled={isPending}
        className="rounded border border-line bg-surface px-2 py-2 text-sm text-fg disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="all">Todos los campeones</option>
        {champions.map((c) => (
          <option key={c.champion_name} value={c.champion_name}>
            {c.champion_name} ({c.games_played})
          </option>
        ))}
      </select>
    </div>
  );
}
