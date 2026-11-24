"use client"

import { useTranslations } from "next-intl"

import { Badge } from "~/components/ui/badge"
import { useSchoolFormat } from "~/features/settings/use-school-format"

import {
  academicKeys,
  sessionsApi,
  setupKeys,
  termsApi,
  type AcademicYearRow,
  type Term,
} from "../api"
import { SessionSelect, useSessions } from "./session-picker"
import { compact, num, SetupTable, text } from "./setup-table"

/**
 * `/dashboard/academics/sessions`: academic sessions (one is current) and
 * the terms inside the chosen one.
 */
export function SessionsScreen() {
  const t = useTranslations("academicSetup.sessions")
  const f = useSchoolFormat()
  const { sessions, sessionId, setSessionId, isPending } = useSessions()
  const chosen = sessions.find((s) => s.id === sessionId)

  return (
    <div className="flex flex-col gap-8">
      <SetupTable<AcademicYearRow>
        title={t("title")}
        description={t("hint")}
        queryKey={setupKeys.sessions}
        invalidate={[academicKeys.currentSession]}
        queryFn={sessionsApi.list}
        rowName={(r) => r.name}
        permissions={{
          create: "academic_years:create",
          update: "academic_years:update",
          delete: "academic_years:delete",
        }}
        emptyTitle={t("empty")}
        columns={[
          {
            label: t("name"),
            cell: (r) => (
              <span className="flex items-center gap-2 font-medium">
                {r.name}
                {r.isCurrent && <Badge>{t("current")}</Badge>}
                {!r.isActive && (
                  <Badge variant="outline">{t("inactive")}</Badge>
                )}
              </span>
            ),
          },
          {
            label: t("dates"),
            cell: (r) =>
              r.startDate && r.endDate
                ? t("range", {
                    from: f.date(r.startDate),
                    to: f.date(r.endDate),
                  })
                : "—",
          },
          {
            label: t("code"),
            className: "hidden md:table-cell",
            cell: (r) => r.code ?? "—",
          },
        ]}
        fields={[
          { name: "name", label: t("name"), required: true, maxLength: 80 },
          { name: "code", label: t("code"), maxLength: 40 },
          {
            name: "startDate",
            label: t("start"),
            type: "date",
            required: true,
          },
          { name: "endDate", label: t("end"), type: "date", required: true },
          { name: "isCurrent", label: t("makeCurrent"), type: "checkbox" },
          { name: "isActive", label: t("active"), type: "checkbox" },
        ]}
        emptyForm={{
          name: "",
          code: "",
          startDate: "",
          endDate: "",
          isCurrent: false,
          isActive: true,
        }}
        toForm={(r) => ({
          name: r.name,
          code: r.code ?? "",
          startDate: r.startDate ?? "",
          endDate: r.endDate ?? "",
          isCurrent: r.isCurrent,
          isActive: r.isActive,
        })}
        onCreate={(v) =>
          sessionsApi.create(
            compact({
              name: text(v, "name"),
              code: text(v, "code"),
              startDate: text(v, "startDate"),
              endDate: text(v, "endDate"),
              isCurrent: Boolean(v.isCurrent),
              isActive: Boolean(v.isActive),
            })
          )
        }
        onUpdate={(r, v) =>
          sessionsApi.update(
            r.id,
            compact({
              name: text(v, "name"),
              code: text(v, "code"),
              startDate: text(v, "startDate"),
              endDate: text(v, "endDate"),
              // Unsetting "current" isn't a thing: another session takes it.
              isCurrent: v.isCurrent ? true : null,
              isActive: Boolean(v.isActive),
            })
          )
        }
        onDelete={(r) => sessionsApi.remove(r.id)}
      />

      <SetupTable<Term>
        title={t("termsTitle")}
        description={
          chosen ? t("termsHint", { session: chosen.name }) : undefined
        }
        toolbar={
          sessions.length > 0 && (
            <SessionSelect
              sessions={sessions}
              value={sessionId}
              onChange={setSessionId}
            />
          )
        }
        enabled={Boolean(sessionId)}
        waiting={isPending}
        queryKey={setupKeys.terms(sessionId)}
        queryFn={async (signal) =>
          (await termsApi.list(sessionId, signal)).sort(
            (a, b) =>
              a.sortOrder - b.sortOrder ||
              a.startDate.localeCompare(b.startDate)
          )
        }
        rowName={(r) => r.name}
        permissions={{
          create: "terms:create",
          update: "terms:update",
          delete: "terms:delete",
        }}
        emptyTitle={t("termsEmpty")}
        emptyBody={t("termsEmptyBody")}
        columns={[
          {
            label: t("name"),
            cell: (r) => <span className="font-medium">{r.name}</span>,
          },
          {
            label: t("dates"),
            cell: (r) =>
              t("range", { from: f.date(r.startDate), to: f.date(r.endDate) }),
          },
        ]}
        fields={[
          { name: "name", label: t("name"), required: true, maxLength: 80 },
          { name: "sortOrder", label: t("order"), type: "number" },
          {
            name: "startDate",
            label: t("start"),
            type: "date",
            required: true,
          },
          { name: "endDate", label: t("end"), type: "date", required: true },
        ]}
        emptyForm={{ name: "", sortOrder: "", startDate: "", endDate: "" }}
        toForm={(r) => ({
          name: r.name,
          sortOrder: String(r.sortOrder),
          startDate: r.startDate,
          endDate: r.endDate,
        })}
        onCreate={(v) =>
          termsApi.create(
            compact({
              academicYearId: sessionId,
              name: text(v, "name"),
              sortOrder: num(v, "sortOrder"),
              startDate: text(v, "startDate"),
              endDate: text(v, "endDate"),
            })
          )
        }
        onUpdate={(r, v) =>
          termsApi.update(
            r.id,
            compact({
              name: text(v, "name"),
              sortOrder: num(v, "sortOrder"),
              startDate: text(v, "startDate"),
              endDate: text(v, "endDate"),
            })
          )
        }
        onDelete={(r) => termsApi.remove(r.id)}
      />
    </div>
  )
}
