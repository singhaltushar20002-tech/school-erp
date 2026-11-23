"use client"

import { useTranslations } from "next-intl"

import { Badge } from "~/components/ui/badge"
import { useSchoolFormat } from "~/features/settings/use-school-format"

import {
  ROOM_TYPES,
  roomsApi,
  setupKeys,
  shiftsApi,
  type Room,
  type Shift,
} from "../api"
import { compact, num, SetupTable, text } from "./setup-table"

const hhmm = (time: string) => time.slice(0, 5)

/** `/dashboard/academics/shifts-rooms`: school shifts and rooms. */
export function ShiftsRoomsScreen() {
  const t = useTranslations("academicSetup.shiftsRooms")
  const f = useSchoolFormat()

  return (
    <div className="flex flex-col gap-8">
      <SetupTable<Shift>
        title={t("shifts")}
        description={t("shiftsHint")}
        queryKey={setupKeys.shifts}
        queryFn={async (signal) =>
          (await shiftsApi.list(signal)).sort(
            (a, b) =>
              a.sortOrder - b.sortOrder ||
              a.startTime.localeCompare(b.startTime)
          )
        }
        rowName={(r) => r.name}
        permissions={{
          create: "shifts:create",
          update: "shifts:update",
          delete: "shifts:delete",
        }}
        emptyTitle={t("shiftsEmpty")}
        emptyBody={t("shiftsEmptyBody")}
        columns={[
          {
            label: t("name"),
            cell: (r) => <span className="font-medium">{r.name}</span>,
          },
          {
            label: t("timing"),
            cell: (r) =>
              t("timeRange", {
                from: hhmm(r.startTime),
                to: hhmm(r.endTime),
              }),
          },
        ]}
        fields={[
          { name: "name", label: t("name"), required: true, maxLength: 60 },
          { name: "sortOrder", label: t("order"), type: "number" },
          {
            name: "startTime",
            label: t("starts"),
            type: "time",
            required: true,
          },
          { name: "endTime", label: t("ends"), type: "time", required: true },
        ]}
        emptyForm={{ name: "", sortOrder: "", startTime: "", endTime: "" }}
        toForm={(r) => ({
          name: r.name,
          sortOrder: String(r.sortOrder),
          startTime: hhmm(r.startTime),
          endTime: hhmm(r.endTime),
        })}
        onCreate={(v) =>
          shiftsApi.create(
            compact({
              name: text(v, "name"),
              sortOrder: num(v, "sortOrder"),
              startTime: text(v, "startTime"),
              endTime: text(v, "endTime"),
            })
          )
        }
        onUpdate={(r, v) =>
          shiftsApi.update(
            r.id,
            compact({
              name: text(v, "name"),
              sortOrder: num(v, "sortOrder"),
              startTime: text(v, "startTime"),
              endTime: text(v, "endTime"),
            })
          )
        }
        onDelete={(r) => shiftsApi.remove(r.id)}
      />

      <SetupTable<Room>
        title={t("rooms")}
        description={t("roomsHint")}
        queryKey={setupKeys.rooms}
        queryFn={async (signal) =>
          (await roomsApi.list(signal)).sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true })
          )
        }
        rowName={(r) => r.name}
        permissions={{
          create: "rooms:create",
          update: "rooms:update",
          delete: "rooms:delete",
        }}
        emptyTitle={t("roomsEmpty")}
        emptyBody={t("roomsEmptyBody")}
        columns={[
          {
            label: t("name"),
            cell: (r) => (
              <span className="flex items-center gap-2 font-medium">
                {r.name}
                {!r.isActive && (
                  <Badge variant="outline">{t("inactive")}</Badge>
                )}
              </span>
            ),
          },
          { label: t("type"), cell: (r) => t(`roomTypes.${r.type}`) },
          {
            label: t("building"),
            className: "hidden md:table-cell",
            cell: (r) => r.building ?? "—",
          },
          {
            label: t("capacity"),
            className: "text-right",
            cell: (r) => (r.capacity == null ? "—" : f.number(r.capacity)),
          },
        ]}
        fields={[
          { name: "name", label: t("name"), required: true, maxLength: 60 },
          {
            name: "type",
            label: t("type"),
            type: "select",
            required: true,
            options: ROOM_TYPES.map((r) => ({
              value: r,
              label: t(`roomTypes.${r}`),
            })),
          },
          { name: "building", label: t("building"), maxLength: 120 },
          { name: "capacity", label: t("capacity"), type: "number" },
          { name: "isActive", label: t("active"), type: "checkbox" },
        ]}
        emptyForm={{
          name: "",
          type: "classroom",
          building: "",
          capacity: "",
          isActive: true,
        }}
        toForm={(r) => ({
          name: r.name,
          type: r.type,
          building: r.building ?? "",
          capacity: r.capacity == null ? "" : String(r.capacity),
          isActive: r.isActive,
        })}
        onCreate={(v) =>
          roomsApi.create(
            compact({
              name: text(v, "name"),
              type: text(v, "type"),
              building: text(v, "building"),
              capacity: num(v, "capacity"),
              isActive: Boolean(v.isActive),
            })
          )
        }
        onUpdate={(r, v) =>
          roomsApi.update(r.id, {
            name: text(v, "name"),
            type: text(v, "type"),
            building: text(v, "building"),
            capacity: num(v, "capacity"),
            isActive: Boolean(v.isActive),
          })
        }
        onDelete={(r) => roomsApi.remove(r.id)}
      />
    </div>
  )
}
