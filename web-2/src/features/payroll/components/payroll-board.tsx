"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FileDownIcon, LockIcon, PencilIcon, RefreshCwIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Empty, EmptyHeader, EmptyTitle } from "~/components/ui/empty"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Skeleton } from "~/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { toast } from "~/components/ui/toast"
import { Can } from "~/features/access/can"
import { displaySettingsQuery } from "~/features/settings/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"
import { todayIn } from "~/lib/format"

import {
  createRun,
  payrollKeys,
  payslipPdf,
  runAction,
  runQuery,
  runsQuery,
  saveStructure,
  structuresQuery,
  type StaffSalary,
} from "../api"

/** `/dashboard/payroll`: salaries and the monthly payroll. */
export function PayrollBoard() {
  const t = useTranslations("payroll")
  const [tab, setTab] = useState<"runs" | "salaries">("runs")
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={t("view")} className="flex gap-1.5">
        {(["runs", "salaries"] as const).map((k) => (
          <Button
            key={k}
            role="tab"
            size="sm"
            aria-selected={tab === k}
            variant={tab === k ? "default" : "outline"}
            onClick={() => setTab(k)}
          >
            {t(`tabs.${k}`)}
          </Button>
        ))}
      </div>
      {tab === "runs" ? <Runs /> : <Salaries />}
    </div>
  )
}

function useFail() {
  const t = useTranslations("payroll")
  return (error: unknown) =>
    toast.add({
      title: t("failed"),
      description: isApiError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : undefined,
      type: "error",
    })
}

const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + by, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

function Runs() {
  const t = useTranslations("payroll")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const fail = useFail()
  const display = useQuery(displaySettingsQuery())
  const thisMonth = todayIn(display.data?.locale.timeZone).slice(0, 7)
  const runs = useQuery(runsQuery())
  const [openId, setOpenId] = useState<string | null>(null)
  const [period, setPeriod] = useState<string | null>(null)
  const have = new Set((runs.data ?? []).map((r) => r.period))
  const next =
    period ?? (have.has(thisMonth) ? shiftMonth(thisMonth, 1) : thisMonth)
  const create = useMutation({
    mutationFn: () => createRun(next),
    onSuccess: async (r) => {
      toast.add({
        title: t("prepared", { month: f.month(r.period) }),
        type: "success",
      })
      await queryClient.invalidateQueries({ queryKey: payrollKeys.all })
      setOpenId(r.id)
    },
    onError: fail,
  })
  if (runs.isPending) return <Skeleton className="h-64 rounded-xl" />
  const current = openId ?? runs.data?.[0]?.id ?? null
  return (
    <div className="flex flex-col gap-4">
      <Can permission="payroll:manage">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="pr-month">{t("month")}</Label>
            <Input
              id="pr-month"
              type="month"
              className="w-44"
              value={next}
              onChange={(e) => e.target.value && setPeriod(e.target.value)}
            />
          </div>
          <Button
            disabled={have.has(next) || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending
              ? t("preparing")
              : t("prepare", { month: f.month(next) })}
          </Button>
        </div>
      </Can>
      {!runs.data?.length ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("noRuns")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {runs.data.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setOpenId(r.id)}
                className={`flex flex-col items-start rounded-xl border bg-card px-4 py-2 text-left ${current === r.id ? "border-primary ring-1 ring-primary" : ""}`}
              >
                <span className="font-medium">{f.month(r.period)}</span>
                <span className="text-xs text-muted-foreground">
                  {t(r.status === "draft" ? "draft" : "finalized")} ·{" "}
                  {t("netTotal", { amount: f.moneyShort(r.net ?? 0) })}
                </span>
              </button>
            ))}
          </div>
          {current && <RunDetail key={current} id={current} />}
        </>
      )}
    </div>
  )
}

function RunDetail({ id }: { id: string }) {
  const t = useTranslations("payroll")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const fail = useFail()
  const run = useQuery(runQuery(id))
  const act = useMutation({
    mutationFn: (a: "recalculate" | "finalize") => runAction(id, a),
    onSuccess: async (r, a) => {
      queryClient.setQueryData(payrollKeys.run(id), r)
      await queryClient.invalidateQueries({ queryKey: payrollKeys.runs })
      toast.add({
        title: a === "finalize" ? t("finalizedToast") : t("recalculated"),
        type: "success",
      })
    },
    onError: fail,
  })
  const pdf = useMutation({
    mutationFn: (slipId: string) => payslipPdf(slipId),
    onSuccess: (url) => window.open(url, "_blank", "noopener"),
    onError: fail,
  })
  if (run.isPending) return <Skeleton className="h-64 rounded-xl" />
  if (run.isError) return null
  const r = run.data
  const slips = r.payslips ?? []
  const sum = (k: "gross" | "totalDeductions" | "net") =>
    slips.reduce((n, s) => n + s[k], 0)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg font-semibold">
          {f.month(r.period)}
        </h2>
        {r.status === "draft" ? (
          <Badge variant="outline">{t("draft")}</Badge>
        ) : (
          <Badge>
            <LockIcon data-icon="inline-start" />
            {t("finalized")}
          </Badge>
        )}
        {r.status === "draft" && (
          <Can permission="payroll:manage">
            <Button
              size="sm"
              variant="outline"
              className="ms-auto"
              disabled={act.isPending}
              onClick={() => act.mutate("recalculate")}
            >
              <RefreshCwIcon data-icon="inline-start" />
              {t("recalculate")}
            </Button>
            <Button
              size="sm"
              disabled={act.isPending || !slips.length}
              onClick={() => act.mutate("finalize")}
            >
              <LockIcon data-icon="inline-start" />
              {t("finalize")}
            </Button>
          </Can>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {t("totals", {
          n: f.number(slips.length),
          gross: f.money(sum("gross")),
          deductions: f.money(sum("totalDeductions")),
          net: f.money(sum("net")),
        })}
      </p>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("employee")}</TableHead>
              <TableHead className="text-right">{t("lop")}</TableHead>
              <TableHead className="text-right">{t("gross")}</TableHead>
              <TableHead className="hidden text-right md:table-cell">
                {t("epf")}
              </TableHead>
              <TableHead className="hidden text-right md:table-cell">
                {t("esi")}
              </TableHead>
              <TableHead className="hidden text-right md:table-cell">
                {t("tds")}
              </TableHead>
              <TableHead className="text-right">{t("net")}</TableHead>
              <TableHead>
                <span className="sr-only">{t("payslip")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slips.map((s) => {
              const d = (k: string) =>
                s.deductions.find((x) => x.key === k)?.amount ?? 0
              return (
                <TableRow key={s.id}>
                  <TableCell>
                    <span className="block font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.designation ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {f.number(s.lopDays)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {f.money(s.gross)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">
                    {f.money(d("epf"))}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">
                    {f.money(d("esi"))}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">
                    {f.money(d("tds"))}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {f.money(s.net)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t("payslipFor", { name: s.name })}
                      disabled={pdf.isPending}
                      onClick={() => pdf.mutate(s.id)}
                    >
                      <FileDownIcon />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{t("rulesHint")}</p>
    </div>
  )
}

function Salaries() {
  const t = useTranslations("payroll")
  const f = useSchoolFormat()
  const list = useQuery(structuresQuery())
  const [editing, setEditing] = useState<StaffSalary | null>(null)
  if (list.isPending) return <Skeleton className="h-64 rounded-xl" />
  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("employee")}</TableHead>
              <TableHead className="text-right">{t("basic")}</TableHead>
              <TableHead className="hidden text-right md:table-cell">
                {t("hra")}
              </TableHead>
              <TableHead className="hidden text-right md:table-cell">
                {t("da")}
              </TableHead>
              <TableHead className="text-right">{t("gross")}</TableHead>
              <TableHead>
                <span className="sr-only">{t("edit")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(list.data ?? []).map((p) => (
              <TableRow key={p.employeeId}>
                <TableCell>
                  <span className="block font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.designation ?? "—"}
                  </span>
                </TableCell>
                {p.structure ? (
                  <>
                    <TableCell className="text-right tabular-nums">
                      {f.money(p.structure.basic)}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">
                      {f.money(p.structure.hra)}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">
                      {f.money(p.structure.da)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {f.money(p.structure.gross)}
                    </TableCell>
                  </>
                ) : (
                  <TableCell colSpan={4} className="text-muted-foreground">
                    {t("notSet")}
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <Can permission="payroll:manage">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t("editFor", { name: p.name })}
                      onClick={() => setEditing(p)}
                    >
                      <PencilIcon />
                    </Button>
                  </Can>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {editing && (
        <SalaryDialog person={editing} onClose={() => setEditing(null)} />
      )}
    </>
  )
}

function SalaryDialog({
  person,
  onClose,
}: {
  person: StaffSalary
  onClose: () => void
}) {
  const t = useTranslations("payroll")
  const queryClient = useQueryClient()
  const fail = useFail()
  const s = person.structure
  const rs = (n?: number) => (n ? String(n / 100) : "")
  const [v, setV] = useState({
    basic: rs(s?.basic),
    hra: rs(s?.hra),
    da: rs(s?.da),
    otherAllowances: rs(s?.otherAllowances),
    tdsMonthly: rs(s?.tdsMonthly),
  })
  const [pf, setPf] = useState(s?.pfApplicable ?? true)
  const [esi, setEsi] = useState(s?.esiApplicable ?? false)
  const minor = (x: string) => Math.round(Number(x || 0) * 100)
  const save = useMutation({
    mutationFn: () =>
      saveStructure(person.employeeId, {
        basic: minor(v.basic),
        hra: minor(v.hra),
        da: minor(v.da),
        otherAllowances: minor(v.otherAllowances),
        tdsMonthly: minor(v.tdsMonthly),
        pfApplicable: pf,
        esiApplicable: esi,
      }),
    onSuccess: async () => {
      toast.add({ title: t("saved"), type: "success" })
      await queryClient.invalidateQueries({ queryKey: payrollKeys.all })
      onClose()
    },
    onError: fail,
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{person.name}</DialogTitle>
          <DialogDescription>{t("salaryHint")}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {(
            ["basic", "hra", "da", "otherAllowances", "tdsMonthly"] as const
          ).map((k) => (
            <div key={k} className="flex flex-col gap-1.5">
              <Label htmlFor={`sal-${k}`}>{t(`fields.${k}`)}</Label>
              <Input
                id={`sal-${k}`}
                inputMode="decimal"
                value={v[k]}
                onChange={(e) =>
                  setV((o) => ({
                    ...o,
                    [k]: e.target.value.replace(/[^\d.]/g, ""),
                  }))
                }
              />
            </div>
          ))}
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={pf}
              onChange={(e) => setPf(e.target.checked)}
            />
            {t("pfApplicable")}
          </label>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={esi}
              onChange={(e) => setEsi(e.target.checked)}
            />
            {t("esiApplicable")}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!v.basic || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
