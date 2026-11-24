"use client"

import { BusIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { cn } from "~/lib/utils"

import type { LivePosition, Stop } from "../api"

/**
 * The route as a line of stops with the bus on it. The position comes
 * from the stop timings until GPS devices are fitted.
 */
export function RouteMap({
  stops,
  live,
  highlight,
}: {
  stops: Stop[]
  live?: LivePosition
  highlight?: string
}) {
  const t = useTranslations("transport")
  const n = stops.length
  const at =
    live && live.status === "running"
      ? live.atStop + live.progress
      : live?.status === "done"
        ? n - 1
        : 0
  const pct = n > 1 ? (at / (n - 1)) * 100 : 0
  return (
    <div className="flex flex-col gap-2">
      <div className="relative mx-3 h-10">
        <div className="absolute top-1/2 right-0 left-0 h-1 -translate-y-1/2 rounded bg-muted" />
        <div
          className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
        {stops.map((s, i) => (
          <span
            key={s.id}
            title={s.name}
            className={cn(
              "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background",
              i <= at ? "bg-primary" : "bg-muted-foreground/40",
              s.id === highlight && "size-4 ring-2 ring-amber-500"
            )}
            style={{ left: `${n > 1 ? (i / (n - 1)) * 100 : 0}%` }}
          />
        ))}
        {live && live.status !== "waiting" && (
          <span
            className="absolute top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500 p-1 text-white shadow transition-all"
            style={{ left: `${pct}%` }}
            aria-label={t("busHere")}
          >
            <BusIcon className="size-3.5" />
          </span>
        )}
      </div>
      <ol className="grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
        {stops.map((s, i) => (
          <li
            key={s.id}
            className={cn(
              "flex justify-between gap-2 rounded px-2 py-1",
              s.id === highlight && "bg-amber-500/15 font-medium"
            )}
          >
            <span className="truncate">
              {i + 1}. {s.name}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {s.pickupTime ?? "—"} / {s.dropTime ?? "—"}
            </span>
          </li>
        ))}
      </ol>
      {live && (
        <p className="text-xs text-muted-foreground">
          {live.status === "running"
            ? t("liveRunning", {
                stop: stops[Math.min(live.atStop + 1, n - 1)]?.name ?? "",
                time: live.time,
              })
            : live.status === "done"
              ? t("liveDone", { time: live.time })
              : t("liveWaiting", { time: live.time })}{" "}
          · {t("simulated")}
        </p>
      )}
    </div>
  )
}
