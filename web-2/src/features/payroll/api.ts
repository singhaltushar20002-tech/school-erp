import { queryOptions } from "@tanstack/react-query"

import { apiFetch } from "~/lib/api/client"

export interface Structure {
  basic: number
  hra: number
  da: number
  otherAllowances: number
  pfApplicable: boolean
  esiApplicable: boolean
  tdsMonthly: number
  gross: number
}

export interface StaffSalary {
  employeeId: string
  name: string
  employeeNumber: string | null
  designation: string | null
  structure: Structure | null
}

export interface PayLine {
  key: string
  label: string
  amount: number
}

export interface Payslip {
  id: string
  employeeId: string
  name: string
  designation: string | null
  employeeNumber: string | null
  daysInMonth: number
  lopDays: number
  gross: number
  earnings: PayLine[]
  deductions: PayLine[]
  totalDeductions: number
  net: number
}

export interface PayrollRun {
  id: string
  period: string
  status: "draft" | "finalized"
  employees?: number
  gross?: number
  net?: number
  payslips?: Payslip[]
}

export const payrollKeys = {
  all: ["payroll"] as const,
  structures: ["payroll", "structures"] as const,
  runs: ["payroll", "runs"] as const,
  run: (id: string) => ["payroll", "run", id] as const,
}

export const structuresQuery = () =>
  queryOptions({
    queryKey: payrollKeys.structures,
    queryFn: ({ signal }) =>
      apiFetch<StaffSalary[]>("/payroll/structures", { signal }),
  })

export const runsQuery = () =>
  queryOptions({
    queryKey: payrollKeys.runs,
    queryFn: ({ signal }) =>
      apiFetch<PayrollRun[]>("/payroll/runs", { signal }),
  })

export const runQuery = (id: string) =>
  queryOptions({
    queryKey: payrollKeys.run(id),
    queryFn: ({ signal }) =>
      apiFetch<PayrollRun>(`/payroll/runs/${id}`, { signal }),
  })

export const saveStructure = (
  employeeId: string,
  body: Omit<Structure, "gross">
) =>
  apiFetch<StaffSalary>(`/payroll/structures/${employeeId}`, {
    method: "PUT",
    body,
  })

export const createRun = (period: string) =>
  apiFetch<PayrollRun>("/payroll/runs", { method: "POST", body: { period } })

export const runAction = (id: string, action: "recalculate" | "finalize") =>
  apiFetch<PayrollRun>(`/payroll/runs/${id}/${action}`, { method: "POST" })

export async function payslipPdf(id: string): Promise<string> {
  type Job = {
    id: string
    status: string
    downloadUrl?: string | null
    error?: string | null
  }
  let job = await apiFetch<Job>(`/payroll/payslips/${id}/pdf`, {
    method: "POST",
  })
  for (let i = 0; i < 60 && job.status !== "succeeded"; i++) {
    if (job.status === "failed") throw new Error(job.error ?? "failed")
    await new Promise((r) => setTimeout(r, 1000))
    job = await apiFetch<Job>(`/jobs/${job.id}`)
  }
  if (!job.downloadUrl) throw new Error("not ready")
  return job.downloadUrl
}
