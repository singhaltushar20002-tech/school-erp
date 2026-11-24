"use client"

import { useQuery } from "@tanstack/react-query"
import { BellIcon, MailIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Pager } from "~/features/shell/components/pager"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { useSchoolFormat } from "~/features/settings/use-school-format"

import { EVENTS, logQuery, type LogFilter } from "../api"

/**
 * `/dashboard/communication/log`: every message the school sent (in-app
 * and email), who got it, when, and whether it went through.
 */
export function CommunicationLog() {
  const t = useTranslations("communicationScreens.log")
  const te = useTranslations("communicationScreens.events")
  const f = useSchoolFormat()
  const [filter, setFilter] = useState<LogFilter>({
    channel: "",
    status: "",
    templateKey: "",
    from: "",
    to: "",
    page: 1,
  })
  const set = <K extends keyof LogFilter>(k: K, v: LogFilter[K]) =>
    setFilter((old) => ({
      ...old,
      [k]: v,
      page: k === "page" ? (v as number) : 1,
    }))
  const list = useQuery(logQuery(filter))
  const rows = list.data?.items ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label={t("event")}
          value={filter.templateKey}
          onChange={(e) =>
            set("templateKey", e.target.value as LogFilter["templateKey"])
          }
        >
          <NativeSelectOption value="">{t("allEvents")}</NativeSelectOption>
          {EVENTS.map((k) => (
            <NativeSelectOption key={k} value={k}>
              {te(k)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t("channel")}
          value={filter.channel}
          onChange={(e) =>
            set("channel", e.target.value as LogFilter["channel"])
          }
        >
          <NativeSelectOption value="">{t("allChannels")}</NativeSelectOption>
          <NativeSelectOption value="in_app">{t("inApp")}</NativeSelectOption>
          <NativeSelectOption value="email">{t("email")}</NativeSelectOption>
        </NativeSelect>
        <NativeSelect
          aria-label={t("status")}
          value={filter.status}
          onChange={(e) => set("status", e.target.value as LogFilter["status"])}
        >
          <NativeSelectOption value="">{t("allStatuses")}</NativeSelectOption>
          {(["sent", "queued", "failed"] as const).map((s) => (
            <NativeSelectOption key={s} value={s}>
              {t(`statuses.${s}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Input
          type="date"
          aria-label={t("from")}
          className="w-40"
          value={filter.from}
          onChange={(e) => set("from", e.target.value)}
        />
        <Input
          type="date"
          aria-label={t("to")}
          className="w-40"
          value={filter.to}
          onChange={(e) => set("to", e.target.value)}
        />
        {list.data && (
          <span className="ms-auto text-sm text-muted-foreground">
            {t("count", {
              count: list.data.meta.total,
              n: f.number(list.data.meta.total),
            })}
          </span>
        )}
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
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("when")}</TableHead>
                <TableHead>{t("to_")}</TableHead>
                <TableHead>{t("message")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {f.dateTime(r.sentAt ?? r.createdAt)}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 font-medium">
                      {r.channel === "email" ? (
                        <MailIcon
                          className="size-3.5 text-muted-foreground"
                          aria-label={t("email")}
                        />
                      ) : (
                        <BellIcon
                          className="size-3.5 text-muted-foreground"
                          aria-label={t("inApp")}
                        />
                      )}
                      {r.recipientName ?? r.recipient}
                    </span>
                    {r.channel === "email" && (
                      <span className="block text-xs text-muted-foreground">
                        {r.recipient}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-md">
                    {r.templateKey && (
                      <span className="block text-xs text-muted-foreground">
                        {te(r.templateKey)}
                      </span>
                    )}
                    <span className="line-clamp-1 text-sm">{r.subject}</span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.status === "failed"
                          ? "destructive"
                          : r.status === "sent"
                            ? "secondary"
                            : "outline"
                      }
                      title={r.error ?? undefined}
                    >
                      {t(`statuses.${r.status}`)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager
        page={filter.page}
        pages={list.data?.meta.totalPages ?? 1}
        onPage={(p) => set("page", p)}
      />
    </div>
  )
}
