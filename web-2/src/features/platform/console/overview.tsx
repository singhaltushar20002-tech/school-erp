"use client"

import { useQuery } from "@tanstack/react-query"
import {
  BuildingIcon,
  GraduationCapIcon,
  HourglassIcon,
  PauseCircleIcon,
} from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Badge } from "~/components/ui/badge"
import { Skeleton } from "~/components/ui/skeleton"
import { useConsoleCan } from "~/features/platform/shell/components/admin-shell"

import { allSchoolsQuery, auditQuery, plansQuery } from "./api"
import { humanize, useConsoleFormat } from "./format"

/** The console's home: how many schools, on which plans, and recent activity. */
export function ConsoleOverview({ name }: { name: string }) {
  const t = useTranslations("console.overview")
  const f = useConsoleFormat()
  const can = useConsoleCan()
  const schools = useQuery({
    ...allSchoolsQuery(),
    enabled: can("organizations:read"),
  })
  const plans = useQuery({ ...plansQuery(), enabled: can("plans:read") })
  const audit = useQuery({
    ...auditQuery({ orgId: "", action: "", from: "", to: "", page: 1 }),
    enabled: can("audit:read"),
  })
  const list = schools.data ?? []
  // Two weeks from when the page opened (read once, not on every render).
  const [soon] = useState(() => Date.now() + 14 * 86_400_000)
  const stats = [
    { key: "schools", icon: BuildingIcon, value: list.length },
    {
      key: "students",
      icon: GraduationCapIcon,
      value: list.reduce((n, s) => n + s.activeStudentCount, 0),
    },
    {
      key: "trials",
      icon: HourglassIcon,
      value: list.filter((s) => s.status === "trial").length,
    },
    {
      key: "attention",
      icon: PauseCircleIcon,
      value: list.filter((s) =>
        ["past_due", "suspended", "inactive"].includes(s.status)
      ).length,
    },
  ] as const
  const trialsEnding = list
    .filter(
      (s) =>
        s.status === "trial" &&
        s.trialEndsAt &&
        new Date(s.trialEndsAt).getTime() < soon
    )
    .sort((a, b) => (a.trialEndsAt ?? "").localeCompare(b.trialEndsAt ?? ""))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {t("title", { name })}
        </h1>
        <p className="text-muted-foreground">{t("body")}</p>
      </header>

      {can("organizations:read") &&
        (schools.isPending ? (
          <Skeleton className="h-28 rounded-xl" />
        ) : (
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map(({ key, icon: Icon, value }) => (
              <div
                key={key}
                className="flex items-start gap-3 rounded-xl border bg-card p-4"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4.5">
                  <Icon aria-hidden />
                </span>
                <span className="flex flex-col">
                  <dt className="text-sm text-muted-foreground">
                    {t(`stats.${key}`)}
                  </dt>
                  <dd className="text-2xl font-semibold tabular-nums">
                    {f.number(value)}
                  </dd>
                </span>
              </div>
            ))}
          </dl>
        ))}

      <div className="grid gap-4 lg:grid-cols-2">
        {can("plans:read") && (
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <h2 className="font-semibold">{t("byPlan")}</h2>
            <ul className="flex flex-col gap-2">
              {(plans.data?.plans ?? []).map((p) => {
                const n = list.filter((s) => s.plan?.code === p.code).length
                const pct = list.length ? (n / list.length) * 100 : 0
                return (
                  <li key={p.code} className="flex flex-col gap-1">
                    <span className="flex justify-between text-sm">
                      <span>{p.name}</span>
                      <span className="tabular-nums">{f.number(n)}</span>
                    </span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  </li>
                )
              })}
            </ul>
            {trialsEnding.length > 0 && (
              <>
                <h3 className="mt-2 text-sm font-medium">
                  {t("trialsEnding")}
                </h3>
                <ul className="flex flex-col gap-1 text-sm">
                  {trialsEnding.map((s) => (
                    <li key={s.id} className="flex justify-between">
                      <Link
                        href={`/schools/${s.id}`}
                        className="hover:underline"
                      >
                        {s.name}
                      </Link>
                      <span className="text-muted-foreground">
                        {f.date(s.trialEndsAt!)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
        {can("audit:read") && (
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{t("recent")}</h2>
              <Link
                href="/audit"
                className="text-sm text-primary hover:underline"
              >
                {t("allActivity")}
              </Link>
            </div>
            {audit.isPending ? (
              <Skeleton className="h-40" />
            ) : (
              <ul className="flex flex-col divide-y text-sm">
                {(audit.data?.items ?? []).slice(0, 8).map((e) => (
                  <li key={e.id} className="flex items-center gap-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate">
                      {humanize(e.action)}
                    </span>
                    {e.orgId && (
                      <Badge variant="outline">
                        {list.find((s) => s.id === e.orgId)?.slug ?? "—"}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {f.dateTime(e.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
