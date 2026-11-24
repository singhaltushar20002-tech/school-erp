"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ReceiptTextIcon } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Pager } from "~/features/shell/components/pager"
import { Badge } from "~/components/ui/badge"
import { Button, buttonVariants } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "~/components/ui/empty"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
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
import { Textarea } from "~/components/ui/textarea"
import { toast } from "~/components/ui/toast"
import { Can } from "~/features/access/can"
import { classesQuery } from "~/features/academics/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"
import { cn } from "~/lib/utils"

import {
  cancelInvoice,
  financeKeys,
  INVOICE_STATUSES,
  invoiceQuery,
  invoicesQuery,
  type InvoiceRow,
  type InvoiceStatus,
} from "../api"

const STATUS_VARIANT: Record<
  InvoiceStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  open: "outline",
  partially_paid: "secondary",
  paid: "default",
  cancelled: "destructive",
}

/** `/dashboard/fees/invoices`: every bill, by class, month and status. */
export function InvoicesScreen() {
  const t = useTranslations("invoicesScreen")
  const f = useSchoolFormat()
  const classes = useQuery(classesQuery())
  const [classId, setClassId] = useState("")
  const [period, setPeriod] = useState("")
  const [status, setStatus] = useState<InvoiceStatus | "">("")
  const [page, setPage] = useState(1)
  const list = useQuery(invoicesQuery({ classId, period, status, page }))
  const rows = list.data?.items ?? []
  const [openId, setOpenId] = useState<string | null>(null)
  const reset = () => setPage(1)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <NativeSelect
          aria-label={t("class")}
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value)
            reset()
          }}
        >
          <NativeSelectOption value="">{t("allClasses")}</NativeSelectOption>
          {(classes.data ?? [])
            .slice()
            .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
            .map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name}
              </NativeSelectOption>
            ))}
        </NativeSelect>
        <Input
          type="month"
          aria-label={t("month")}
          className="w-44"
          value={period}
          onChange={(e) => {
            setPeriod(e.target.value)
            reset()
          }}
        />
        <NativeSelect
          aria-label={t("status")}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as InvoiceStatus | "")
            reset()
          }}
        >
          <NativeSelectOption value="">{t("allStatuses")}</NativeSelectOption>
          {INVOICE_STATUSES.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {t(`statuses.${s}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
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
                <TableHead>{t("number")}</TableHead>
                <TableHead>{t("student")}</TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t("forWhat")}
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  {t("due")}
                </TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead className="text-right">{t("balance")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((inv) => (
                <TableRow
                  key={inv.id}
                  className="cursor-pointer"
                  onClick={() => setOpenId(inv.id)}
                >
                  <TableCell className="font-mono text-sm">
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => setOpenId(inv.id)}
                    >
                      {inv.number}
                    </button>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{inv.student.fullName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {inv.enrollment?.schoolClass?.name}{" "}
                      {inv.enrollment?.section?.name}
                    </span>
                  </TableCell>
                  <TableCell className="hidden max-w-56 truncate text-sm lg:table-cell">
                    {inv.note ??
                      (inv.period ? f.month(inv.period) : t("adhoc"))}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {f.date(inv.dueDate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {f.money(inv.netTotal)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium tabular-nums",
                      inv.outstanding > 0 &&
                        inv.status !== "cancelled" &&
                        "text-destructive"
                    )}
                  >
                    {inv.status === "cancelled"
                      ? "—"
                      : f.money(inv.outstanding)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[inv.status]}>
                      {t(`statuses.${inv.status}`)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager
        page={page}
        pages={list.data?.meta.totalPages ?? 1}
        onPage={setPage}
      />
      {openId && <InvoiceDialog id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function InvoiceDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useTranslations("invoicesScreen")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const invoice = useQuery(invoiceQuery(id))
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState("")
  const cancel = useMutation({
    mutationFn: () => cancelInvoice(id, reason.trim()),
    onSuccess: async () => {
      toast.add({ title: t("cancelled"), type: "success" })
      await queryClient.invalidateQueries({ queryKey: financeKeys.all })
      onClose()
    },
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  const inv: InvoiceRow | undefined = invoice.data
  return (
    <Dialog open onOpenChange={(o) => !o && !cancel.isPending && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptTextIcon className="size-5" />
            {inv?.number ?? t("invoice")}
          </DialogTitle>
          <DialogDescription>
            {inv &&
              t("summary", {
                name: inv.student.fullName,
                issued: f.date(inv.issueDate),
                due: f.date(inv.dueDate),
              })}
          </DialogDescription>
        </DialogHeader>
        {!inv ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("item")}</TableHead>
                    <TableHead className="text-right">{t("amount")}</TableHead>
                    <TableHead className="text-right">{t("paid")}</TableHead>
                    <TableHead className="text-right">{t("balance")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(inv.lines ?? []).map((l) => (
                    <TableRow
                      key={l.id}
                      className={cn(l.cancelled && "line-through opacity-60")}
                    >
                      <TableCell className="text-sm">
                        {l.description}
                        {l.discount > 0 && (
                          <span className="block text-xs text-muted-foreground">
                            {t("discount", { amount: f.money(l.discount) })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {f.money(l.net)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {f.money(l.allocated + l.adjusted - l.refunded)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {f.money(l.outstanding)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">{t("amount")}</dt>
                <dd className="font-semibold tabular-nums">
                  {f.money(inv.netTotal)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("paid")}</dt>
                <dd className="font-semibold tabular-nums">
                  {f.money(inv.allocatedTotal)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("balance")}</dt>
                <dd className="font-semibold tabular-nums">
                  {f.money(inv.outstanding)}
                </dd>
              </div>
            </dl>
            {inv.status === "cancelled" && inv.cancelReason && (
              <p className="rounded-lg bg-muted p-3 text-sm">
                {t("cancelledBecause", { reason: inv.cancelReason })}
              </p>
            )}
            {cancelling && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inv-reason">{t("reason")}</Label>
                <Textarea
                  id="inv-reason"
                  rows={2}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            )}
          </>
        )}
        <DialogFooter>
          {inv && inv.status !== "cancelled" && inv.allocatedTotal === 0 && (
            <Can permission="fees:bill">
              {cancelling ? (
                <Button
                  variant="destructive"
                  disabled={!reason.trim() || cancel.isPending}
                  onClick={() => cancel.mutate()}
                >
                  {t("cancelConfirm")}
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setCancelling(true)}>
                  {t("cancelInvoice")}
                </Button>
              )}
            </Can>
          )}
          {inv && inv.outstanding > 0 && inv.status !== "cancelled" && (
            <Can permission="fees:collect">
              <Link
                href={`/dashboard/fees/collect?student=${inv.studentId}`}
                className={buttonVariants()}
              >
                {t("collect")}
              </Link>
            </Can>
          )}
          <Button variant="outline" onClick={onClose}>
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
