import { queryOptions } from "@tanstack/react-query"

import { apiFetch } from "~/lib/api/client"

export interface Stop {
  id: string
  name: string
  pickupTime: string | null
  dropTime: string | null
  sortOrder: number
  students: number
}

export interface Route {
  id: string
  name: string
  vehicleNumber: string | null
  driverName: string | null
  driverPhone: string | null
  monthlyFee: number
  stops: Stop[]
  students: number
}

export interface LivePosition {
  trip: "pickup" | "drop" | null
  status: "waiting" | "running" | "done"
  atStop: number
  progress: number
  time: string
  simulated: true
}

export interface RouteStudent {
  studentId: string
  name: string
  admissionNumber: string
  className: string | null
  sectionName: string | null
  stopId: string
}

export const transportKeys = {
  all: ["transport"] as const,
  routes: ["transport", "routes"] as const,
  students: (id: string) => ["transport", "students", id] as const,
  live: (id: string) => ["transport", "live", id] as const,
}

export const routesQuery = () =>
  queryOptions({
    queryKey: transportKeys.routes,
    queryFn: ({ signal }) => apiFetch<Route[]>("/transport/routes", { signal }),
  })

export const routeStudentsQuery = (id: string) =>
  queryOptions({
    queryKey: transportKeys.students(id),
    queryFn: ({ signal }) =>
      apiFetch<RouteStudent[]>(`/transport/routes/${id}/students`, { signal }),
  })

export const liveQuery = (id: string) =>
  queryOptions({
    queryKey: transportKeys.live(id),
    queryFn: ({ signal }) =>
      apiFetch<LivePosition>(`/transport/routes/${id}/live`, { signal }),
    refetchInterval: 30_000,
  })

export interface RouteInput {
  name: string
  vehicleNumber?: string | null
  driverName?: string | null
  driverPhone?: string | null
  monthlyFee: number
  stops: {
    name: string
    pickupTime?: string | null
    dropTime?: string | null
  }[]
}

export const saveRoute = (id: string | null, body: RouteInput) =>
  id
    ? apiFetch<Route>(`/transport/routes/${id}`, { method: "PATCH", body })
    : apiFetch<Route>("/transport/routes", { method: "POST", body })

export const assignStop = (studentId: string, stopId: string) =>
  apiFetch("/transport/assignments", {
    method: "PUT",
    body: { studentId, stopId },
  })

export const unassignStop = (studentId: string) =>
  apiFetch<void>(`/transport/assignments/${studentId}`, { method: "DELETE" })

export const billTransport = (period: string) =>
  apiFetch<{ period: string; created: number; skipped: number }>(
    "/transport/billing",
    { method: "POST", body: { period } }
  )
