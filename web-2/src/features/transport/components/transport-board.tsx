"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  PencilIcon,
  PlusIcon,
  ReceiptIcon,
  Trash2Icon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Empty, EmptyHeader, EmptyTitle } from "~/components/ui/empty"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { Skeleton } from "~/components/ui/skeleton"
import { toast } from "~/components/ui/toast"
import { Can } from "~/features/access/can"
import { WidgetCard } from "~/features/dashboard/components/widget-group"
import { displaySettingsQuery } from "~/features/settings/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import type { StudentRow } from "~/features/students/api"
import { apiFetchPage } from "~/lib/api/client"
import { isApiError } from "~/lib/api/errors"
import { todayIn } from "~/lib/format"

import {
  assignStop,
  billTransport,
  liveQuery,
  routesQuery,
  routeStudentsQuery,
  saveRoute,
  transportKeys,
  unassignStop,
  type Route,
} from "../api"
import { RouteMap } from "./route-map"

/** `/dashboard/transport`: routes, stops, students on them, and billing. */
export function TransportBoard() {
  const t = useTranslations("transport")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const display = useQuery(displaySettingsQuery())
  const month = todayIn(display.data?.locale.timeZone).slice(0, 7)
  const routes = useQuery(routesQuery())
  const [editing, setEditing] = useState<Route | "new" | null>(null)
  const bill = useMutation({
    mutationFn: () => billTransport(month),
    onSuccess: async (r) => {
      toast.add({
        title: t("billed", {
          created: f.number(r.created),
          month: f.month(month),
        }),
        description: r.skipped
          ? t("billedSkipped", { n: f.number(r.skipped) })
          : undefined,
        type: "success",
      })
      await queryClient.invalidateQueries()
    },
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  if (routes.isPending) return <Skeleton className="h-96 rounded-xl" />
  const list = routes.data ?? []
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {t("summary", {
            routes: f.number(list.length),
            students: f.number(list.reduce((n, r) => n + r.students, 0)),
          })}
        </span>
        <Can permission="transport:manage">
          <Button
            variant="outline"
            className="ms-auto"
            disabled={bill.isPending || !list.length}
            onClick={() => bill.mutate()}
          >
            <ReceiptIcon data-icon="inline-start" />
            {t("bill", { month: f.month(month) })}
          </Button>
          <Button onClick={() => setEditing("new")}>
            <PlusIcon data-icon="inline-start" />
            {t("addRoute")}
          </Button>
        </Can>
      </div>
      {list.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("none")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        list.map((r) => (
          <RouteCard key={r.id} route={r} onEdit={() => setEditing(r)} />
        ))
      )}
      {editing && (
        <RouteDialog
          route={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function RouteCard({ route, onEdit }: { route: Route; onEdit: () => void }) {
  const t = useTranslations("transport")
  const f = useSchoolFormat()
  const live = useQuery(liveQuery(route.id))
  const [open, setOpen] = useState(false)
  return (
    <WidgetCard
      title={route.name}
      description={[
        route.vehicleNumber,
        route.driverName &&
          t("driver", {
            name: route.driverName,
            phone: route.driverPhone ?? "",
          }),
        t("feePerMonth", { fee: f.money(route.monthlyFee) }),
      ]
        .filter(Boolean)
        .join(" · ")}
    >
      <div className="flex flex-col gap-3">
        <RouteMap stops={route.stops} live={live.data} />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpen((o) => !o)}
          >
            <UsersIcon data-icon="inline-start" />
            {t("students", { n: f.number(route.students) })}
          </Button>
          <Can permission="transport:manage">
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <PencilIcon data-icon="inline-start" />
              {t("edit")}
            </Button>
          </Can>
        </div>
        {open && <RouteStudents route={route} />}
      </div>
    </WidgetCard>
  )
}

function RouteStudents({ route }: { route: Route }) {
  const t = useTranslations("transport")
  const queryClient = useQueryClient()
  const students = useQuery(routeStudentsQuery(route.id))
  const [studentId, setStudentId] = useState("")
  const [stopId, setStopId] = useState(route.stops[0]?.id ?? "")
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: transportKeys.all })
  const add = useMutation({
    mutationFn: async () => {
      const found = await apiFetchPage<StudentRow>("/students", {
        query: { admissionNumber: studentId.trim(), limit: 1 },
      })
      const s = found.items[0]
      if (!s) throw new Error(t("noStudent", { id: studentId.trim() }))
      await assignStop(s.id, stopId)
    },
    onSuccess: async () => {
      setStudentId("")
      toast.add({ title: t("assigned"), type: "success" })
      await refresh()
    },
    onError: (error) =>
      toast.add({
        title: error instanceof Error ? error.message : t("failed"),
        type: "error",
      }),
  })
  const remove = useMutation({
    mutationFn: (id: string) => unassignStop(id),
    onSuccess: refresh,
  })
  const stopName = (id: string) =>
    route.stops.find((s) => s.id === id)?.name ?? ""
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <Can permission="transport:manage">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`sid-${route.id}`}>{t("studentId")}</Label>
            <Input
              id={`sid-${route.id}`}
              className="w-36"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`stop-${route.id}`}>{t("stop")}</Label>
            <NativeSelect
              id={`stop-${route.id}`}
              value={stopId}
              onChange={(e) => setStopId(e.target.value)}
            >
              {route.stops.map((s) => (
                <NativeSelectOption key={s.id} value={s.id}>
                  {s.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <Button
            size="sm"
            disabled={!studentId.trim() || !stopId || add.isPending}
            onClick={() => add.mutate()}
          >
            {t("addStudent")}
          </Button>
        </div>
      </Can>
      {students.isPending ? (
        <Skeleton className="h-24" />
      ) : (
        <ul className="flex max-h-72 flex-col divide-y overflow-y-auto text-sm">
          {(students.data ?? []).map((s) => (
            <li key={s.studentId} className="flex items-center gap-2 py-1.5">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{s.name}</span>{" "}
                <span className="text-muted-foreground">
                  {s.className} {s.sectionName}
                </span>
              </span>
              <Badge variant="outline">{stopName(s.stopId)}</Badge>
              <Can permission="transport:manage">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("removeStudent", { name: s.name })}
                  onClick={() => remove.mutate(s.studentId)}
                >
                  <XIcon />
                </Button>
              </Can>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type StopRow = { name: string; pickupTime: string; dropTime: string }

function RouteDialog({
  route,
  onClose,
}: {
  route: Route | null
  onClose: () => void
}) {
  const t = useTranslations("transport")
  const queryClient = useQueryClient()
  const [name, setName] = useState(route?.name ?? "")
  const [vehicle, setVehicle] = useState(route?.vehicleNumber ?? "")
  const [driver, setDriver] = useState(route?.driverName ?? "")
  const [phone, setPhone] = useState(route?.driverPhone ?? "")
  const [fee, setFee] = useState(route ? String(route.monthlyFee / 100) : "")
  const [stops, setStops] = useState<StopRow[]>(
    route?.stops.map((s) => ({
      name: s.name,
      pickupTime: s.pickupTime ?? "",
      dropTime: s.dropTime ?? "",
    })) ?? [{ name: "", pickupTime: "", dropTime: "" }]
  )
  const setStop = (i: number, patch: Partial<StopRow>) =>
    setStops((list) => list.map((s, k) => (k === i ? { ...s, ...patch } : s)))
  const save = useMutation({
    mutationFn: () =>
      saveRoute(route?.id ?? null, {
        name: name.trim(),
        vehicleNumber: vehicle.trim() || null,
        driverName: driver.trim() || null,
        driverPhone: phone.trim() || null,
        monthlyFee: Math.round(Number(fee || 0) * 100),
        stops: stops
          .filter((s) => s.name.trim())
          .map((s) => ({
            name: s.name.trim(),
            pickupTime: s.pickupTime || null,
            dropTime: s.dropTime || null,
          })),
      }),
    onSuccess: async () => {
      toast.add({ title: t("saved"), type: "success" })
      await queryClient.invalidateQueries({ queryKey: transportKeys.all })
      onClose()
    },
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{route ? route.name : t("addRoute")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rt-name">{t("routeName")}</Label>
            <Input
              id="rt-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rt-vehicle">{t("vehicle")}</Label>
            <Input
              id="rt-vehicle"
              value={vehicle}
              maxLength={24}
              onChange={(e) => setVehicle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rt-driver">{t("driverName")}</Label>
            <Input
              id="rt-driver"
              value={driver}
              maxLength={80}
              onChange={(e) => setDriver(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rt-phone">{t("driverPhone")}</Label>
            <Input
              id="rt-phone"
              inputMode="tel"
              value={phone}
              maxLength={20}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rt-fee">{t("monthlyFee")}</Label>
            <Input
              id="rt-fee"
              inputMode="decimal"
              value={fee}
              onChange={(e) => setFee(e.target.value.replace(/[^\d.]/g, ""))}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("stops")}</span>
          {stops.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                aria-label={t("stopName", { n: i + 1 })}
                placeholder={t("stopPlaceholder")}
                value={s.name}
                onChange={(e) => setStop(i, { name: e.target.value })}
              />
              <Input
                aria-label={t("pickup")}
                type="time"
                className="w-28"
                value={s.pickupTime}
                onChange={(e) => setStop(i, { pickupTime: e.target.value })}
              />
              <Input
                aria-label={t("drop")}
                type="time"
                className="w-28"
                value={s.dropTime}
                onChange={(e) => setStop(i, { dropTime: e.target.value })}
              />
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t("removeStop")}
                onClick={() => setStops((l) => l.filter((_, k) => k !== i))}
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            className="w-fit"
            onClick={() =>
              setStops((l) => [
                ...l,
                { name: "", pickupTime: "", dropTime: "" },
              ])
            }
          >
            <PlusIcon data-icon="inline-start" />
            {t("addStop")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("stopsHint")}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!name.trim() || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
