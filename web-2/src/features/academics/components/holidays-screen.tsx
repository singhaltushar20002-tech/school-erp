"use client"

import { useTranslations } from "next-intl"

import { Badge } from "~/components/ui/badge"
import { useSchoolFormat } from "~/features/settings/use-school-format"

import {
  academicKeys,
  createHoliday,
  deleteHoliday,
  fetchAll,
  updateHoliday,
  type Holiday,
} from "../api"
import { SessionSelect, useSessions } from "./session-picker"
import { SetupTable, text } from "./setup-table"

const TYPES: Holiday["type"][] = ["public", "school", "religious"]

/**
 * `/dashboard/attendance/holidays`: the session's holiday list. Attendance
 * refuses these days, and the calendar shows them.
 */
export function HolidaysScreen() {
  const t = useTranslations("academicSetup.holidays")
  const f = useSchoolFormat()
  const { sessions, sessionId, setSessionId, isPending } = useSessions()
  const session = sessions.find((s) => s.id === sessionId)
  const from = session?.startDate ?? ""
  const to = session?.endDate ?? ""

  return (
    <SetupTable<Holiday>
      toolbar={
        sessions.length > 0 && (
          <SessionSelect
            sessions={sessions}
            value={sessionId}
            onChange={setSessionId}
          />
        )
      }
      enabled={Boolean(from && to)}
      waiting={isPending}
      queryKey={academicKeys.holidays(from, to)}
      queryFn={async (signal) =>
        (await fetchAll<Holiday>("/holidays", signal, { from, to })).sort(
          (a, b) => a.dateFrom.localeCompare(b.dateFrom)
        )
      }
      rowName={(r) => r.name}
      permissions={{
        create: "holidays:create",
        update: "holidays:update",
        delete: "holidays:delete",
      }}
      emptyTitle={t("empty")}
      emptyBody={t("emptyBody")}
      columns={[
        {
          label: t("name"),
          cell: (r) => <span className="font-medium">{r.name}</span>,
        },
        {
          label: t("dates"),
          cell: (r) =>
            r.dateFrom === r.dateTo
              ? f.date(r.dateFrom)
              : t("range", { from: f.date(r.dateFrom), to: f.date(r.dateTo) }),
        },
        {
          label: t("type"),
          cell: (r) => <Badge variant="outline">{t(`types.${r.type}`)}</Badge>,
        },
      ]}
      fields={[
        {
          name: "name",
          label: t("name"),
          required: true,
          maxLength: 120,
          wide: true,
        },
        { name: "dateFrom", label: t("from"), type: "date", required: true },
        { name: "dateTo", label: t("to"), type: "date", hint: t("toHint") },
        {
          name: "type",
          label: t("type"),
          type: "select",
          required: true,
          options: TYPES.map((x) => ({ value: x, label: t(`types.${x}`) })),
        },
      ]}
      emptyForm={{ name: "", dateFrom: "", dateTo: "", type: "school" }}
      toForm={(r) => ({
        name: r.name,
        dateFrom: r.dateFrom,
        dateTo: r.dateTo,
        type: r.type,
      })}
      onCreate={(v) =>
        createHoliday({
          name: text(v, "name")!,
          type: v.type as Holiday["type"],
          dateFrom: text(v, "dateFrom")!,
          dateTo: text(v, "dateTo") ?? undefined,
        })
      }
      onUpdate={(r, v) =>
        updateHoliday(r.id, {
          name: text(v, "name")!,
          type: v.type as Holiday["type"],
          dateFrom: text(v, "dateFrom")!,
          dateTo: text(v, "dateTo") ?? text(v, "dateFrom")!,
        })
      }
      onDelete={(r) => deleteHoliday(r.id)}
    />
  )
}
