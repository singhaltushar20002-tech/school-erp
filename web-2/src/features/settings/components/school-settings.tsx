"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { Skeleton } from "~/components/ui/skeleton"
import { Switch } from "~/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { toast } from "~/components/ui/toast"
import { usePermissions } from "~/features/access/use-permissions"
import { allows } from "~/features/access/permissions"
import { apiFetch } from "~/lib/api/client"
import { isApiError } from "~/lib/api/errors"

import { settingsKeys } from "../api"

// `GET /settings` sections this screen edits (backend settings.types.ts).
interface AllSettings {
  organization: { name: string; eiin: string | null }
  profile: {
    address: {
      line1: string | null
      line2: string | null
      area: string | null
      district: string | null
      postCode: string | null
    }
    phone: string | null
    email: string | null
    website: string | null
    establishedYear: number | null
    principalName: string | null
  }
  locale: {
    language: "en" | "hi"
    dateFormat: string
    weekStart: string
    weekendDays: string[]
    timeZone: string
    currency: string
  }
  numbering: Record<string, string | boolean>
  portal: { studentAccounts: boolean; studentMinLevel: number }
  attendance: {
    mode: "day" | "period"
    lockAfterDays: number
    cutoffTime: string | null
  }
  fees: {
    billingDay: number
    dueDay: number
    graceDays: number
    reminderDays: number[]
    blockResultsOnDues: boolean
  }
  notifications: {
    events: Record<string, { inApp: boolean; email: boolean; sms: boolean }>
  }
  security: { sessionIdleMinutes: number | null }
}

const TABS = [
  "profile",
  "regional",
  "attendance",
  "fees",
  "notifications",
  "numbering",
  "portal",
  "security",
] as const
type Tab = (typeof TABS)[number]

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const
const DATE_FORMATS = ["DD/MM/YYYY", "DD-MM-YYYY", "YYYY-MM-DD", "D MMM YYYY"]
const EVENTS = [
  "absent",
  "feeDue",
  "paymentReceived",
  "resultPublished",
  "noticePublished",
] as const
const NUMBERS = [
  "studentId",
  "employeeId",
  "roll",
  "receipt",
  "invoice",
  "certificate",
  "voucher",
] as const

/**
 * `/dashboard/settings`: how the school runs: its profile, language and
 * week, attendance lock, billing days, which messages go out, document
 * numbers, parent/student portal and sign-in timeout. Each tab saves on
 * its own.
 */
export function SchoolSettings() {
  const t = useTranslations("settingsScreen")
  const settings = useQuery({
    queryKey: settingsKeys.all,
    queryFn: ({ signal }) => apiFetch<AllSettings>("/settings", { signal }),
  })
  const [tab, setTab] = useState<Tab>("profile")
  const permissions = usePermissions()
  const canEdit = allows(permissions, { permission: "settings:update" })

  if (settings.isPending || !settings.data)
    return <Skeleton className="h-96 rounded-xl" />
  const s = settings.data

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="flex-wrap">
          {TABS.map((x) => (
            <TabsTrigger key={x} value={x}>
              {t(`tabs.${x}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {!canEdit && (
        <p className="rounded-lg bg-muted p-3 text-sm">{t("readOnly")}</p>
      )}
      <fieldset
        disabled={!canEdit}
        className="rounded-xl border bg-card p-4"
        key={tab}
      >
        {tab === "profile" && <ProfileTab s={s} />}
        {tab === "regional" && <RegionalTab s={s} />}
        {tab === "attendance" && <AttendanceTab s={s} />}
        {tab === "fees" && <FeesTab s={s} />}
        {tab === "notifications" && <NotificationsTab s={s} />}
        {tab === "numbering" && <NumberingTab s={s} />}
        {tab === "portal" && <PortalTab s={s} />}
        {tab === "security" && <SecurityTab s={s} />}
      </fieldset>
    </div>
  )
}

/** Saves one section (`PATCH /settings/<section>`), then refreshes. */
function useSave(section: string) {
  const t = useTranslations("settingsScreen")
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch<unknown>(`/settings/${section}`, { method: "PATCH", body }),
    onSuccess: async () => {
      toast.add({ title: t("saved"), type: "success" })
      await queryClient.invalidateQueries({ queryKey: ["settings"] })
    },
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
}

function Field({
  id,
  label,
  hint,
  children,
  wide,
}: {
  id: string
  label: string
  hint?: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div
      className={
        wide ? "flex flex-col gap-1.5 sm:col-span-2" : "flex flex-col gap-1.5"
      }
    >
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function SaveBar({ busy, onSave }: { busy: boolean; onSave: () => void }) {
  const t = useTranslations("settingsScreen")
  return (
    <div className="mt-4 flex justify-end">
      <Button disabled={busy} onClick={onSave}>
        {busy ? t("saving") : t("save")}
      </Button>
    </div>
  )
}

const nul = (v: string) => (v.trim() === "" ? null : v.trim())

function ProfileTab({ s }: { s: AllSettings }) {
  const t = useTranslations("settingsScreen.profile")
  const org = useSave("organization")
  const profile = useSave("profile")
  const [v, setV] = useState({
    name: s.organization.name,
    line1: s.profile.address.line1 ?? "",
    line2: s.profile.address.line2 ?? "",
    area: s.profile.address.area ?? "",
    district: s.profile.address.district ?? "",
    postCode: s.profile.address.postCode ?? "",
    phone: s.profile.phone ?? "",
    email: s.profile.email ?? "",
    website: s.profile.website ?? "",
    establishedYear: s.profile.establishedYear?.toString() ?? "",
    principalName: s.profile.principalName ?? "",
  })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((old) => ({ ...old, [k]: e.target.value }))
  const text = (k: keyof typeof v, max = 200, wide = false) => (
    <Field id={`p-${k}`} label={t(k)} wide={wide}>
      <Input id={`p-${k}`} maxLength={max} value={v[k]} onChange={set(k)} />
    </Field>
  )
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {text("name", 200, true)}
        {text("line1", 200, true)}
        {text("line2", 200, true)}
        {text("area")}
        {text("district")}
        {text("postCode", 12)}
        {text("phone", 20)}
        {text("email")}
        {text("website")}
        {text("establishedYear", 4)}
        {text("principalName")}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{t("logoHint")}</p>
      <SaveBar
        busy={org.isPending || profile.isPending}
        onSave={async () => {
          if (v.name.trim() !== s.organization.name)
            await org.mutateAsync({ name: v.name.trim() })
          profile.mutate({
            address: {
              line1: nul(v.line1),
              line2: nul(v.line2),
              area: nul(v.area),
              district: nul(v.district),
              postCode: nul(v.postCode),
            },
            phone: nul(v.phone),
            email: nul(v.email),
            website: nul(v.website),
            establishedYear: v.establishedYear
              ? Number(v.establishedYear)
              : null,
            principalName: nul(v.principalName),
          })
        }}
      />
    </>
  )
}

function RegionalTab({ s }: { s: AllSettings }) {
  const t = useTranslations("settingsScreen.regional")
  const tw = useTranslations("settingsScreen.weekdays")
  const save = useSave("locale")
  const [language, setLanguage] = useState(s.locale.language)
  const [dateFormat, setDateFormat] = useState(s.locale.dateFormat)
  const [weekStart, setWeekStart] = useState(s.locale.weekStart)
  const [weekend, setWeekend] = useState(new Set(s.locale.weekendDays))
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="r-lang" label={t("language")} hint={t("languageHint")}>
          <NativeSelect
            id="r-lang"
            className="w-full"
            value={language}
            onChange={(e) => setLanguage(e.target.value as "en" | "hi")}
          >
            <NativeSelectOption value="en">{t("english")}</NativeSelectOption>
            <NativeSelectOption value="hi">{t("hindi")}</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field id="r-date" label={t("dateFormat")}>
          <NativeSelect
            id="r-date"
            className="w-full"
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value)}
          >
            {DATE_FORMATS.map((d) => (
              <NativeSelectOption key={d} value={d}>
                {d}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field id="r-week" label={t("weekStart")}>
          <NativeSelect
            id="r-week"
            className="w-full"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
          >
            {WEEKDAYS.map((d) => (
              <NativeSelectOption key={d} value={d}>
                {tw(d)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field id="r-tz" label={t("timeZone")} hint={t("fixedHint")}>
          <Input
            id="r-tz"
            readOnly
            value={`${s.locale.timeZone} · ${s.locale.currency}`}
          />
        </Field>
        <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
          <legend className="mb-1 text-sm font-medium">{t("weekend")}</legend>
          <div className="flex flex-wrap gap-3">
            {WEEKDAYS.map((d) => (
              <Label key={d} className="flex items-center gap-2 font-normal">
                <Checkbox
                  checked={weekend.has(d)}
                  onCheckedChange={(on) =>
                    setWeekend((old) => {
                      const next = new Set(old)
                      if (on) next.add(d)
                      else next.delete(d)
                      return next
                    })
                  }
                />
                {tw(d)}
              </Label>
            ))}
          </div>
        </fieldset>
      </div>
      <SaveBar
        busy={save.isPending}
        onSave={() =>
          save.mutate({
            language,
            dateFormat,
            weekStart,
            weekendDays: [...weekend],
          })
        }
      />
    </>
  )
}

function AttendanceTab({ s }: { s: AllSettings }) {
  const t = useTranslations("settingsScreen.attendance")
  const save = useSave("attendance")
  const [mode, setMode] = useState(s.attendance.mode)
  const [lock, setLock] = useState(String(s.attendance.lockAfterDays))
  const [cutoff, setCutoff] = useState(s.attendance.cutoffTime ?? "")
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="a-mode" label={t("mode")} hint={t("modeHint")}>
          <NativeSelect
            id="a-mode"
            className="w-full"
            value={mode}
            onChange={(e) => setMode(e.target.value as "day" | "period")}
          >
            <NativeSelectOption value="day">{t("day")}</NativeSelectOption>
            <NativeSelectOption value="period">
              {t("period")}
            </NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field id="a-lock" label={t("lock")} hint={t("lockHint")}>
          <Input
            id="a-lock"
            type="number"
            min={0}
            value={lock}
            onChange={(e) => setLock(e.target.value)}
          />
        </Field>
        <Field id="a-cut" label={t("cutoff")} hint={t("cutoffHint")}>
          <Input
            id="a-cut"
            type="time"
            value={cutoff}
            onChange={(e) => setCutoff(e.target.value)}
          />
        </Field>
      </div>
      <SaveBar
        busy={save.isPending}
        onSave={() =>
          save.mutate({
            mode,
            lockAfterDays: Number(lock) || 0,
            cutoffTime: cutoff || null,
          })
        }
      />
    </>
  )
}

function FeesTab({ s }: { s: AllSettings }) {
  const t = useTranslations("settingsScreen.fees")
  const save = useSave("fees")
  const [v, setV] = useState({
    billingDay: String(s.fees.billingDay),
    dueDay: String(s.fees.dueDay),
    graceDays: String(s.fees.graceDays),
    reminderDays: s.fees.reminderDays.join(", "),
  })
  const [block, setBlock] = useState(s.fees.blockResultsOnDues)
  const num = (k: "billingDay" | "dueDay" | "graceDays", max: number) => (
    <Field id={`f-${k}`} label={t(k)} hint={t(`${k}Hint`)}>
      <Input
        id={`f-${k}`}
        type="number"
        min={k === "graceDays" ? 0 : 1}
        max={max}
        value={v[k]}
        onChange={(e) => setV((o) => ({ ...o, [k]: e.target.value }))}
      />
    </Field>
  )
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {num("billingDay", 28)}
        {num("dueDay", 28)}
        {num("graceDays", 60)}
        <Field
          id="f-reminders"
          label={t("reminderDays")}
          hint={t("reminderDaysHint")}
        >
          <Input
            id="f-reminders"
            value={v.reminderDays}
            onChange={(e) =>
              setV((o) => ({ ...o, reminderDays: e.target.value }))
            }
          />
        </Field>
        <Label className="flex items-center gap-2 font-normal sm:col-span-2">
          <Switch checked={block} onCheckedChange={(on) => setBlock(on)} />
          {t("blockResults")}
        </Label>
      </div>
      <SaveBar
        busy={save.isPending}
        onSave={() =>
          save.mutate({
            billingDay: Number(v.billingDay),
            dueDay: Number(v.dueDay),
            graceDays: Number(v.graceDays),
            reminderDays: v.reminderDays
              .split(/[,\s]+/)
              .filter(Boolean)
              .map(Number)
              .filter((n) => Number.isInteger(n) && n > 0),
            blockResultsOnDues: block,
          })
        }
      />
    </>
  )
}

function NotificationsTab({ s }: { s: AllSettings }) {
  const t = useTranslations("settingsScreen.notifications")
  const te = useTranslations("communicationScreens.events")
  const save = useSave("notifications")
  const [events, setEvents] = useState(s.notifications.events)
  const toggle = (event: string, channel: "inApp" | "email", on: boolean) =>
    setEvents((old) => ({
      ...old,
      [event]: { ...old[event]!, [channel]: on },
    }))
  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">{t("hint")}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-2 font-normal">{t("event")}</th>
            <th className="py-2 text-center font-normal">{t("inApp")}</th>
            <th className="py-2 text-center font-normal">{t("email")}</th>
            <th className="py-2 text-center font-normal">{t("sms")}</th>
          </tr>
        </thead>
        <tbody>
          {EVENTS.map((e) => (
            <tr key={e} className="border-t">
              <td className="py-2">{te(e)}</td>
              {(["inApp", "email"] as const).map((c) => (
                <td key={c} className="py-2 text-center">
                  <Checkbox
                    aria-label={t("toggle", { event: te(e), channel: t(c) })}
                    checked={events[e]?.[c] ?? false}
                    onCheckedChange={(on) => toggle(e, c, Boolean(on))}
                  />
                </td>
              ))}
              <td className="py-2 text-center text-xs text-muted-foreground">
                {t("smsSoon")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <SaveBar
        busy={save.isPending}
        onSave={() =>
          save.mutate({
            events: Object.fromEntries(
              EVENTS.map((e) => [
                e,
                { inApp: events[e]?.inApp, email: events[e]?.email },
              ])
            ),
          })
        }
      />
    </>
  )
}

function NumberingTab({ s }: { s: AllSettings }) {
  const t = useTranslations("settingsScreen.numbering")
  const save = useSave("numbering")
  const [v, setV] = useState(
    Object.fromEntries(NUMBERS.map((k) => [k, String(s.numbering[k] ?? "")]))
  )
  const [manual, setManual] = useState(
    Boolean(s.numbering.allowManualStudentId)
  )
  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">{t("hint")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {NUMBERS.map((k) => (
          <Field key={k} id={`n-${k}`} label={t(k)}>
            <Input
              id={`n-${k}`}
              className="font-mono"
              maxLength={60}
              value={v[k]}
              onChange={(e) => setV((o) => ({ ...o, [k]: e.target.value }))}
            />
          </Field>
        ))}
        <Label className="flex items-center gap-2 font-normal sm:col-span-2">
          <Switch checked={manual} onCheckedChange={(on) => setManual(on)} />
          {t("allowManual")}
        </Label>
      </div>
      <SaveBar
        busy={save.isPending}
        onSave={() => save.mutate({ ...v, allowManualStudentId: manual })}
      />
    </>
  )
}

function PortalTab({ s }: { s: AllSettings }) {
  const t = useTranslations("settingsScreen.portal")
  const save = useSave("portal")
  const [on, setOn] = useState(s.portal.studentAccounts)
  const [level, setLevel] = useState(String(s.portal.studentMinLevel))
  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">{t("hint")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="flex items-center gap-2 font-normal sm:col-span-2">
          <Switch checked={on} onCheckedChange={(v) => setOn(v)} />
          {t("studentAccounts")}
        </Label>
        <Field id="pt-level" label={t("minLevel")} hint={t("minLevelHint")}>
          <Input
            id="pt-level"
            type="number"
            min={1}
            max={12}
            disabled={!on}
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          />
        </Field>
      </div>
      <SaveBar
        busy={save.isPending}
        onSave={() =>
          save.mutate({
            studentAccounts: on,
            studentMinLevel: Number(level) || 1,
          })
        }
      />
    </>
  )
}

function SecurityTab({ s }: { s: AllSettings }) {
  const t = useTranslations("settingsScreen.security")
  const save = useSave("security")
  const [idle, setIdle] = useState(
    s.security.sessionIdleMinutes == null
      ? ""
      : String(s.security.sessionIdleMinutes)
  )
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="s-idle" label={t("idle")} hint={t("idleHint")}>
          <NativeSelect
            id="s-idle"
            className="w-full"
            value={idle}
            onChange={(e) => setIdle(e.target.value)}
          >
            <NativeSelectOption value="">{t("never")}</NativeSelectOption>
            {[30, 60, 240, 480, 1440, 10080].map((m) => (
              <NativeSelectOption key={m} value={String(m)}>
                {m < 60
                  ? t("minutes", { n: m })
                  : m < 1440
                    ? t("hours", { n: m / 60 })
                    : t("days", { n: m / 1440 })}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <SaveBar
        busy={save.isPending}
        onSave={() =>
          save.mutate({ sessionIdleMinutes: idle ? Number(idle) : null })
        }
      />
    </>
  )
}
