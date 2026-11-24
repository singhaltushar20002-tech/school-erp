"use client"

import { useQuery } from "@tanstack/react-query"
import { ChevronDownIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Badge } from "~/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "~/components/ui/empty"
import { Input } from "~/components/ui/input"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { Skeleton } from "~/components/ui/skeleton"
import { cn } from "~/lib/utils"

import { allSchoolsQuery, auditQuery, type AuditEntry } from "./api"
import { ConsolePager, humanize, useConsoleFormat } from "./format"

/** Action groups the platform log can be filtered by (a prefix match). */
const GROUPS = ["auth", "organization", "platform_user", "membership"] as const

/**
 * `/audit` on the admin host: platform actions and sign-ins: schools
 * created or changed, plan and limit changes, staff changes, console
 * sign-ins, with values before and after.
 */
export function AuditScreen() {
  const t = useTranslations("console.audit")
  const f = useConsoleFormat()
  const schools = useQuery(allSchoolsQuery())
  const [orgId, setOrgId] = useState("")
  const [action, setAction] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [page, setPage] = useState(1)
  const list = useQuery(auditQuery({ orgId, action, from, to, page }))
  const rows = list.data?.items ?? []
  const slug = (id: string | null) =>
    id ? (schools.data?.find((s) => s.id === id)?.name ?? null) : null

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="font-display text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label={t("kind")}
          value={action}
          onChange={(e) => {
            setAction(e.target.value)
            setPage(1)
          }}
        >
          <NativeSelectOption value="">{t("allKinds")}</NativeSelectOption>
          {GROUPS.map((g) => (
            <NativeSelectOption key={g} value={`${g}.`}>
              {t(`kinds.${g}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t("school")}
          value={orgId}
          onChange={(e) => {
            setOrgId(e.target.value)
            setPage(1)
          }}
        >
          <NativeSelectOption value="">{t("allSchools")}</NativeSelectOption>
          {(schools.data ?? []).map((s) => (
            <NativeSelectOption key={s.id} value={s.id}>
              {s.name}
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
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyTitle>{t("empty")}</EmptyTitle>
            <EmptyDescription>{t("emptyBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {rows.map((e) => (
            <Row
              key={e.id}
              entry={e}
              school={slug(e.orgId)}
              when={f.dateTime(e.createdAt)}
            />
          ))}
        </ul>
      )}
      <ConsolePager
        page={page}
        pages={list.data?.meta.totalPages ?? 1}
        onPage={setPage}
      />
    </div>
  )
}

function Row({
  entry,
  school,
  when,
}: {
  entry: AuditEntry
  school: string | null
  when: string
}) {
  const t = useTranslations("console.audit")
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
        {school && <Badge variant="outline">{school}</Badge>}
        {entry.ip && (
          <span className="text-xs text-muted-foreground">{entry.ip}</span>
        )}
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
