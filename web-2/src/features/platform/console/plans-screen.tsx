"use client"

import { useQuery } from "@tanstack/react-query"
import { CheckIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Badge } from "~/components/ui/badge"
import { Skeleton } from "~/components/ui/skeleton"
import { useConsoleCan } from "~/features/platform/shell/components/admin-shell"

import { allSchoolsQuery, plansQuery, type Limits } from "./api"
import { humanize, useConsoleFormat } from "./format"

const LIMIT_KEYS: (keyof Limits)[] = [
  "students",
  "admins",
  "users",
  "storageMb",
]

/**
 * `/plans` on the admin host: what each plan costs, which modules it
 * includes, its limits, and how many schools are on it. Plans are set in
 * code (`plans.catalog.ts`), so this screen only reads them.
 */
export function PlansScreen() {
  const t = useTranslations("console.plans")
  const f = useConsoleFormat()
  const can = useConsoleCan()
  const plans = useQuery(plansQuery())
  const schools = useQuery({
    ...allSchoolsQuery(),
    enabled: can("organizations:read"),
  })

  if (plans.isPending) return <Skeleton className="h-96 rounded-xl" />
  const catalog = plans.data
  const all = catalog?.modules ?? []

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="font-display text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(catalog?.plans ?? [])
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((p) => {
            const count = (schools.data ?? []).filter(
              (s) => s.plan?.code === p.code
            ).length
            return (
              <section
                key={p.id}
                className="flex flex-col gap-3 rounded-xl border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold">{p.name}</h2>
                  {!p.isActive && (
                    <Badge variant="outline">{t("retired")}</Badge>
                  )}
                </div>
                <p className="text-sm">
                  {p.pricePerStudent === 0
                    ? t("free")
                    : t("price", {
                        perStudent: f.money(p.pricePerStudent, p.currency),
                        min: f.money(p.minFee, p.currency),
                      })}
                </p>
                {schools.data && (
                  <p className="text-sm text-muted-foreground">
                    {t("schools", { count, n: f.number(count) })}
                  </p>
                )}
                <dl className="grid grid-cols-2 gap-1 text-sm">
                  {LIMIT_KEYS.map((k) => (
                    <div key={k}>
                      <dt className="text-xs text-muted-foreground">
                        {t(`limit.${k}`)}
                      </dt>
                      <dd className="tabular-nums">
                        {p.limits[k] == null
                          ? t("unlimited")
                          : k === "storageMb"
                            ? p.limits[k] < 1024
                              ? t("mb", { n: f.number(p.limits[k]) })
                              : t("gb", { n: f.number(p.limits[k] / 1024) })
                            : f.number(p.limits[k])}
                      </dd>
                    </div>
                  ))}
                </dl>
                <ul className="flex flex-col gap-1 border-t pt-3 text-sm">
                  {all.map((m) => {
                    const has = p.modules.includes(m)
                    const addOn = catalog?.addOnModules.includes(m)
                    if (!has && !addOn) return null
                    return (
                      <li
                        key={m}
                        className={
                          has
                            ? "flex items-center gap-1.5"
                            : "flex items-center gap-1.5 text-muted-foreground"
                        }
                      >
                        {has ? (
                          <CheckIcon className="size-3.5 text-primary" />
                        ) : (
                          <span className="size-3.5" />
                        )}
                        {humanize(m)}
                        {!has && addOn && (
                          <span className="text-xs">{t("addOn")}</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
      </div>
    </div>
  )
}
