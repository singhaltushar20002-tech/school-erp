"use client"

import { useQuery } from "@tanstack/react-query"
import { ChevronDownIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Pager } from "~/features/shell/components/pager"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "~/components/ui/empty"
import { Input } from "~/components/ui/input"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { Skeleton } from "~/components/ui/skeleton"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { cn } from "~/lib/utils"

import {
  auditQuery,
  membersQuery,
  type AuditEntry,
  type AuditFilter,
} from "../api"

/** Common areas of the audit log, for the filter. */
const AREAS = [
  "user",
  "role",
  "employee",
  "payment",
  "invoice",
  "student_discount",
  "billing_run",
  "expense",
  "attendance_register",
  "mark_sheet",
  "result_definition",
  "certificate",
  "promotion_batch",
  "import",
  "academic_year",
  "settings",
] as const

/** `fee_structure.updated` → "Fee structure updated". */
const humanize = (action: string) => {
  const s = action.replace(/[._]/g, " ")
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * `/dashboard/admin/audit-log`: who did what and when (sign-ins, role and
 * member changes, money, marks, attendance corrections), with the values
 * before and after.
 */
export function AuditLogScreen() {
  const t = useTranslations("adminScreens.audit")
  const f = useSchoolFormat()
  const members = useQuery(membersQuery())
  const [area, setArea] = useState("")
  const [actorUserId, setActor] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [page, setPage] = useState(1)
  const filter: AuditFilter = {
    action: "",
    entityType: area,
    actorUserId,
    from,
    to,
    page,
  }
  const list = useQuery(auditQuery(filter))
  const rows = list.data?.items ?? []
  const names = new Map((members.data ?? []).map((m) => [m.id, m.name]))
  const staff = (members.data ?? []).filter(
    (m) => !m.roles.every((r) => r.name === "guardian" || r.name === "student")
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label={t("area")}
          value={area}
          onChange={(e) => {
            setArea(e.target.value)
            setPage(1)
          }}
        >
          <NativeSelectOption value="">{t("allAreas")}</NativeSelectOption>
          {AREAS.map((a) => (
            <NativeSelectOption key={a} value={a}>
              {humanize(a)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t("who")}
          value={actorUserId}
          onChange={(e) => {
            setActor(e.target.value)
            setPage(1)
          }}
        >
          <NativeSelectOption value="">{t("anyone")}</NativeSelectOption>
          {staff.map((m) => (
            <NativeSelectOption key={m.id} value={m.id}>
              {m.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Input
          type="date"
          aria-label={t("from")}
          className="w-40"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value)
            setPage(1)
          }}
        />
        <Input
          type="date"
          aria-label={t("to")}
          className="w-40"
          value={to}
          onChange={(e) => {
            setTo(e.target.value)
            setPage(1)
          }}
        />
      </div>

      {list.isPending ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : rows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("empty")}</EmptyTitle>
            <EmptyDescription>{t("emptyBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {rows.map((e) => (
            <AuditRow
              key={e.id}
              entry={e}
              who={
                e.actorUserId
                  ? (names.get(e.actorUserId) ?? t("someone"))
                  : t("system")
              }
              when={f.dateTime(e.createdAt)}
            />
          ))}
        </ul>
      )}
      <Pager
        page={page}
        pages={list.data?.meta.totalPages ?? 1}
        onPage={setPage}
      />
    </div>
  )
}

function AuditRow({
  entry,
  who,
  when,
}: {
  entry: AuditEntry
  who: string
  when: string
}) {
  const t = useTranslations("adminScreens.audit")
  const [open, setOpen] = useState(false)
  const keys = [
    ...new Set([
      ...Object.keys(entry.before ?? {}),
      ...Object.keys(entry.after ?? {}),
    ]),
  ]
  const show = (v: unknown) =>
    v === null || v === undefined
      ? "—"
      : typeof v === "object"
        ? JSON.stringify(v)
        : String(v)
  return (
    <li className="px-4 py-3">
      <button
        type="button"
        aria-expanded={open}
        disabled={keys.length === 0}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left"
      >
        <span className="w-40 shrink-0 text-xs text-muted-foreground tabular-nums">
          {when}
        </span>
        <span className="font-medium">{humanize(entry.action)}</span>
        <span className="text-sm text-muted-foreground">
          {t("by", { name: who })}
          {entry.ip && ` · ${entry.ip}`}
        </span>
        {keys.length > 0 && (
          <ChevronDownIcon
            className={cn(
              "ms-auto size-4 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        )}
      </button>
      {open && (
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 font-normal">{t("field")}</th>
              <th className="py-1 font-normal">{t("before")}</th>
              <th className="py-1 font-normal">{t("after")}</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {keys.map((k) => (
              <tr key={k} className="border-t align-top">
                <td className="py-1 pe-3">{k}</td>
                <td className="py-1 pe-3 break-all">
                  {show(entry.before?.[k])}
                </td>
                <td className="py-1 break-all">{show(entry.after?.[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </li>
  )
}
