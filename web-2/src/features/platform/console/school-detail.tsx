"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeftIcon, ExternalLinkIcon, MailIcon } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState, useSyncExternalStore } from "react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { Skeleton } from "~/components/ui/skeleton"
import { toast } from "~/components/ui/toast"
import { appConfig } from "~/config/app-config"
import { useConsoleCan } from "~/features/platform/shell/components/admin-shell"
import { isApiError } from "~/lib/api/errors"

import {
  changePlan,
  consoleKeys,
  extendTrial,
  membersQuery,
  PLAN_CODES,
  plansQuery,
  platformUserQuery,
  resendOwnerLink,
  schoolQuery,
  setLimits,
  updateSchool,
  type Limits,
  type PlanCode,
} from "./api"
import { humanize, useConsoleFormat } from "./format"
import { STATUS_VARIANT } from "./schools-screen"

const LIMIT_KEYS = ["students", "storageMb", "users", "admins"] as const

/** A school's own address; on `*.localhost` in development, its alias. */
function schoolUrl(slug: string, hostname: string) {
  const protocol = new URL(appConfig.appUrl).protocol
  const local = appConfig.localhostAlias && hostname.endsWith("localhost")
  const host = `${slug}.${local ? "localhost" : appConfig.rootDomain}`
  return `${protocol}//${host}${appConfig.appPort ? `:${appConfig.appPort}` : ""}`
}

/** `/schools/:id` on the admin host: one school's plan, owner and limits. */
export function SchoolDetail({ id }: { id: string }) {
  const t = useTranslations("console.school")
  const ts = useTranslations("console.schools")
  const f = useConsoleFormat()
  const can = useConsoleCan()
  const manage = can("organizations:manage")
  const queryClient = useQueryClient()
  // The browser's host, read after hydration (the server renders without).
  const hostname = useSyncExternalStore(
    () => () => {},
    () => window.location.hostname,
    () => ""
  )
  const school = useQuery(schoolQuery(id))
  const members = useQuery(membersQuery(id))
  const plans = useQuery(plansQuery())
  const ownerId = members.data?.find((m) => m.role === "owner")?.userId ?? ""
  const owner = useQuery(platformUserQuery(ownerId))
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: consoleKeys.all })
  const fail = (error: unknown) =>
    toast.add({
      title: t("failed"),
      description: isApiError(error) ? error.message : undefined,
      type: "error",
    })
  const run = useMutation({
    mutationFn: (v: { fn: () => Promise<unknown>; done: string }) => v.fn(),
    onSuccess: async (_, v) => {
      toast.add({ title: v.done, type: "success" })
      await refresh()
    },
    onError: fail,
  })

  if (school.isPending) return <Skeleton className="h-96 rounded-xl" />
  if (!school.data)
    return <p className="text-sm text-muted-foreground">{t("notFound")}</p>
  const s = school.data
  const plan = plans.data?.plans.find((p) => p.code === s.plan?.code)
  const url = schoolUrl(s.slug, hostname)

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/schools"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("back")}
      </Link>
      <header className="flex flex-wrap items-start gap-3">
        <div className="me-auto">
          <h1 className="font-display text-2xl font-semibold">{s.name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={STATUS_VARIANT[s.status]}>
              {ts(`statuses.${s.status}`)}
            </Badge>
            {ts(`types.${s.type}`)} · {s.district ?? "—"} ·{" "}
            {t("students", { n: f.number(s.activeStudentCount) })}
          </p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          {url.replace(/^https?:\/\//, "")}
          <ExternalLinkIcon className="size-3.5" />
        </a>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("details")}>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <Item label={t("slug")} value={s.slug} mono />
            <Item label={t("udise")} value={s.eiin ?? "—"} mono />
            <Item label={t("joined")} value={f.date(s.createdAt)} />
            <Item
              label={t("setup")}
              value={
                s.onboardingCompletedAt
                  ? t("setupDone", { date: f.date(s.onboardingCompletedAt) })
                  : t("setupPending")
              }
            />
            <Item
              label={t("members")}
              value={members.data ? f.number(members.data.length) : "…"}
            />
          </dl>
          {manage && (
            <div className="mt-3 flex flex-wrap gap-2">
              {s.status === "suspended" ? (
                <Button
                  size="sm"
                  disabled={run.isPending}
                  onClick={() =>
                    run.mutate({
                      fn: () => updateSchool(id, { status: "active" }),
                      done: t("reactivated"),
                    })
                  }
                >
                  {t("reactivate")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={run.isPending}
                  onClick={() =>
                    run.mutate({
                      fn: () => updateSchool(id, { status: "suspended" }),
                      done: t("suspended"),
                    })
                  }
                >
                  {t("suspend")}
                </Button>
              )}
            </div>
          )}
        </Card>

        <Card title={t("owner")}>
          {!ownerId ? (
            <p className="text-sm text-muted-foreground">{t("noOwner")}</p>
          ) : owner.isPending ? (
            <Skeleton className="h-12" />
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              <p>
                <span className="font-medium">{owner.data?.name}</span>
                <span className="block text-muted-foreground">
                  {owner.data?.email ?? owner.data?.phone}
                </span>
              </p>
              <p className="text-muted-foreground">
                {owner.data?.passwordSet
                  ? t("ownerActive")
                  : t("ownerNotActivated")}
              </p>
              {(manage || can("organizations:support")) &&
                !owner.data?.passwordSet && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="self-start"
                    disabled={run.isPending}
                    onClick={() =>
                      run.mutate({
                        fn: () => resendOwnerLink(id),
                        done: t("linkSent"),
                      })
                    }
                  >
                    <MailIcon data-icon="inline-start" />
                    {t("resendLink")}
                  </Button>
                )}
            </div>
          )}
        </Card>

        <PlanCard
          id={id}
          current={s.plan?.code ?? "free"}
          addOns={s.addOnModules}
          trialEndsAt={s.status === "trial" ? s.trialEndsAt : null}
          manage={manage}
        />

        <Card title={t("limits")}>
          <LimitsForm
            id={id}
            planLimits={plan?.limits}
            overrides={s.limitOverrides}
            manage={manage}
          />
        </Card>
      </div>
      {plan && (
        <p className="text-xs text-muted-foreground">
          {t("planModules", {
            modules: plan.modules.map(humanize).join(", "),
          })}
        </p>
      )}
    </div>
  )
}

function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Item({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono" : undefined}>{value}</dd>
    </div>
  )
}

function PlanCard({
  id,
  current,
  addOns,
  trialEndsAt,
  manage,
}: {
  id: string
  current: PlanCode
  addOns: string[]
  trialEndsAt: string | null
  manage: boolean
}) {
  const t = useTranslations("console.school")
  const ts = useTranslations("console.schools")
  const f = useConsoleFormat()
  const queryClient = useQueryClient()
  const plans = useQuery(plansQuery())
  const [code, setCode] = useState<PlanCode>(current)
  const [extras, setExtras] = useState(new Set(addOns))
  const [days, setDays] = useState("15")
  const changed =
    code !== current ||
    extras.size !== addOns.length ||
    addOns.some((a) => !extras.has(a))
  const done = async (title: string) => {
    toast.add({ title, type: "success" })
    await queryClient.invalidateQueries({ queryKey: consoleKeys.all })
  }
  const fail = (error: unknown) =>
    toast.add({
      title: t("failed"),
      description: isApiError(error) ? error.message : undefined,
      type: "error",
    })
  const save = useMutation({
    mutationFn: () =>
      changePlan(id, { planCode: code, addOnModules: [...extras] }),
    onSuccess: () => done(t("planSaved")),
    onError: fail,
  })
  const extend = useMutation({
    mutationFn: () => extendTrial(id, Number(days)),
    onSuccess: () => done(t("trialExtended")),
    onError: fail,
  })
  const selected = plans.data?.plans.find((p) => p.code === code)
  const optional = (plans.data?.addOnModules ?? []).filter(
    (m) => !selected?.modules.includes(m)
  )

  return (
    <Card title={t("plan")}>
      <fieldset disabled={!manage} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sd-plan">{t("plan")}</Label>
          <NativeSelect
            id="sd-plan"
            className="w-full"
            value={code}
            onChange={(e) => setCode(e.target.value as PlanCode)}
          >
            {PLAN_CODES.map((p) => (
              <NativeSelectOption key={p} value={p}>
                {ts(`plans.${p}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {selected && (
            <p className="text-xs text-muted-foreground">
              {t("price", {
                perStudent: f.money(
                  selected.pricePerStudent,
                  selected.currency
                ),
                min: f.money(selected.minFee, selected.currency),
              })}
            </p>
          )}
        </div>
        {optional.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t("addOns")}</span>
            <div className="flex flex-wrap gap-3">
              {optional.map((m) => (
                <Label key={m} className="flex items-center gap-2 font-normal">
                  <Checkbox
                    checked={extras.has(m)}
                    onCheckedChange={(on) =>
                      setExtras((old) => {
                        const next = new Set(old)
                        if (on) next.add(m)
                        else next.delete(m)
                        return next
                      })
                    }
                  />
                  {humanize(m)}
                </Label>
              ))}
            </div>
          </div>
        )}
        {manage && (
          <Button
            size="sm"
            className="self-start"
            disabled={!changed || save.isPending}
            onClick={() => save.mutate()}
          >
            {t("savePlan")}
          </Button>
        )}
        {trialEndsAt && (
          <div className="flex flex-wrap items-end gap-2 border-t pt-3">
            <p className="w-full text-sm">
              {t("trialEnds", { date: f.date(trialEndsAt) })}
            </p>
            {manage && (
              <>
                <Input
                  type="number"
                  aria-label={t("extendDays")}
                  className="w-24"
                  min={1}
                  max={90}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!(Number(days) > 0) || extend.isPending}
                  onClick={() => extend.mutate()}
                >
                  {t("extend")}
                </Button>
              </>
            )}
          </div>
        )}
      </fieldset>
    </Card>
  )
}

function LimitsForm({
  id,
  planLimits,
  overrides,
  manage,
}: {
  id: string
  planLimits: Limits | undefined
  overrides: Limits | null
  manage: boolean
}) {
  const t = useTranslations("console.school")
  const f = useConsoleFormat()
  const queryClient = useQueryClient()
  const [v, setV] = useState(
    Object.fromEntries(
      LIMIT_KEYS.map((k) => [
        k,
        overrides?.[k] == null ? "" : String(overrides[k]),
      ])
    ) as Record<(typeof LIMIT_KEYS)[number], string>
  )
  const save = useMutation({
    mutationFn: () =>
      setLimits(
        id,
        Object.fromEntries(
          LIMIT_KEYS.map((k) => [k, v[k] === "" ? null : Number(v[k])])
        ) as unknown as Limits
      ),
    onSuccess: async () => {
      toast.add({ title: t("limitsSaved"), type: "success" })
      await queryClient.invalidateQueries({ queryKey: consoleKeys.all })
    },
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  return (
    <fieldset disabled={!manage} className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{t("limitsHint")}</p>
      <div className="grid grid-cols-2 gap-3">
        {LIMIT_KEYS.map((k) => (
          <div key={k} className="flex flex-col gap-1.5">
            <Label htmlFor={`lim-${k}`}>{t(`limit.${k}`)}</Label>
            <Input
              id={`lim-${k}`}
              type="number"
              min={0}
              placeholder={
                planLimits?.[k] == null
                  ? t("unlimited")
                  : f.number(planLimits[k])
              }
              value={v[k]}
              onChange={(e) => setV((o) => ({ ...o, [k]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      {manage && (
        <Button
          size="sm"
          className="self-start"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {t("saveLimits")}
        </Button>
      )}
    </fieldset>
  )
}
