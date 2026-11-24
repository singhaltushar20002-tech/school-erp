"use client"

import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Badge } from "~/components/ui/badge"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { useSchoolFormat } from "~/features/settings/use-school-format"

import {
  academicKeys,
  classesApi,
  roomsApi,
  sectionsApi,
  setupKeys,
  shiftsApi,
  type SchoolClass,
  type SectionRow,
} from "../api"
import { SessionSelect, useSessions } from "./session-picker"
import { compact, num, SetupTable, text } from "./setup-table"

/** Classes and the sections they run in a session. */
export function ClassesScreen() {
  const t = useTranslations("academicSetup.classes")
  const f = useSchoolFormat()
  const { sessions, sessionId, setSessionId, isPending } = useSessions()
  const classes = useQuery({
    queryKey: academicKeys.classes,
    queryFn: ({ signal }) => classesApi.list(signal),
  })
  const shifts = useQuery({
    queryKey: setupKeys.shifts,
    queryFn: ({ signal }) => shiftsApi.list(signal),
  })
  const rooms = useQuery({
    queryKey: setupKeys.rooms,
    queryFn: ({ signal }) => roomsApi.list(signal),
  })
  const [picked, setPicked] = useState("")
  const classId = picked || classes.data?.[0]?.id || ""
  const chosen = classes.data?.find((c) => c.id === classId)

  return (
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <SetupTable<SchoolClass>
        title={t("title")}
        description={t("hint")}
        queryKey={academicKeys.classes}
        queryFn={classesApi.list}
        rowName={(r) => r.name}
        permissions={{
          create: "classes:create",
          update: "classes:update",
          delete: "classes:delete",
        }}
        emptyTitle={t("empty")}
        columns={[
          {
            label: t("name"),
            cell: (r) => (
              <button
                type="button"
                className="flex items-center gap-2 text-left font-medium hover:underline"
                onClick={() => setPicked(r.id)}
              >
                {r.name}
                {!r.isActive && (
                  <Badge variant="outline">{t("inactive")}</Badge>
                )}
                {r.id === classId && (
                  <Badge variant="secondary">{t("showing")}</Badge>
                )}
              </button>
            ),
          },
          {
            label: t("level"),
            className: "text-right",
            cell: (r) => (r.level == null ? "—" : f.number(r.level)),
          },
          {
            label: t("code"),
            className: "hidden md:table-cell",
            cell: (r) => r.code ?? "—",
          },
        ]}
        fields={[
          { name: "name", label: t("name"), required: true, maxLength: 120 },
          {
            name: "level",
            label: t("level"),
            type: "number",
            hint: t("levelHint"),
          },
          { name: "code", label: t("code"), maxLength: 40 },
          { name: "isActive", label: t("active"), type: "checkbox" },
        ]}
        emptyForm={{ name: "", level: "", code: "", isActive: true }}
        toForm={(r) => ({
          name: r.name,
          level: r.level == null ? "" : String(r.level),
          code: r.code ?? "",
          isActive: r.isActive,
        })}
        onCreate={(v) =>
          classesApi.create(
            compact({
              name: text(v, "name"),
              level: num(v, "level"),
              code: text(v, "code"),
              isActive: Boolean(v.isActive),
            })
          )
        }
        onUpdate={(r, v) =>
          classesApi.update(r.id, {
            name: text(v, "name"),
            level: num(v, "level"),
            code: text(v, "code"),
            isActive: Boolean(v.isActive),
          })
        }
        onDelete={(r) => classesApi.remove(r.id)}
      />

      <SetupTable<SectionRow>
        title={chosen ? t("sectionsOf", { name: chosen.name }) : t("sections")}
        description={t("sectionsHint")}
        toolbar={
          <>
            <NativeSelect
              aria-label={t("class")}
              value={classId}
              onChange={(e) => setPicked(e.target.value)}
            >
              {(classes.data ?? []).map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {sessions.length > 0 && (
              <SessionSelect
                sessions={sessions}
                value={sessionId}
                onChange={setSessionId}
              />
            )}
          </>
        }
        enabled={Boolean(sessionId && classId)}
        waiting={isPending || classes.isPending}
        queryKey={setupKeys.sectionsOf(sessionId, classId)}
        invalidate={[academicKeys.sections(sessionId)]}
        queryFn={(signal) => sectionsApi.list(sessionId, classId, signal)}
        rowName={(r) => (chosen ? `${chosen.name} ${r.name}` : r.name)}
        permissions={{
          create: "sections:create",
          update: "sections:update",
          delete: "sections:delete",
        }}
        emptyTitle={t("sectionsEmpty")}
        emptyBody={t("sectionsEmptyBody")}
        columns={[
          {
            label: t("section"),
            cell: (r) => <span className="font-medium">{r.name}</span>,
          },
          { label: t("shift"), cell: (r) => r.shift?.name ?? "—" },
          { label: t("room"), cell: (r) => r.room?.name ?? "—" },
          {
            label: t("capacity"),
            className: "text-right",
            cell: (r) => (r.capacity == null ? "—" : f.number(r.capacity)),
          },
        ]}
        fields={[
          { name: "name", label: t("section"), required: true, maxLength: 60 },
          { name: "capacity", label: t("capacity"), type: "number" },
          {
            name: "shiftId",
            label: t("shift"),
            type: "select",
            options: (shifts.data ?? []).map((s) => ({
              value: s.id,
              label: s.name,
            })),
          },
          {
            name: "roomId",
            label: t("room"),
            type: "select",
            options: (rooms.data ?? []).map((r) => ({
              value: r.id,
              label: r.name,
            })),
          },
        ]}
        emptyForm={{ name: "", capacity: "", shiftId: "", roomId: "" }}
        toForm={(r) => ({
          name: r.name,
          capacity: r.capacity == null ? "" : String(r.capacity),
          shiftId: r.shiftId ?? "",
          roomId: r.roomId ?? "",
        })}
        onCreate={(v) =>
          sectionsApi.create(
            compact({
              academicYearId: sessionId,
              classId,
              name: text(v, "name"),
              capacity: num(v, "capacity"),
              shiftId: text(v, "shiftId"),
              roomId: text(v, "roomId"),
            })
          )
        }
        onUpdate={(r, v) =>
          // Nulls are kept here: clearing a shift or room is a real edit.
          sectionsApi.update(r.id, {
            name: text(v, "name"),
            capacity: num(v, "capacity"),
            shiftId: text(v, "shiftId"),
            roomId: text(v, "roomId"),
          })
        }
        onDelete={(r) => sectionsApi.remove(r.id)}
      />
    </div>
  )
}
