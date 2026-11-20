"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  BanknoteIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PrinterIcon,
  ReceiptIcon,
  XCircleIcon,
} from "lucide-react"
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "~/components/ui/empty"
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
import { Textarea } from "~/components/ui/textarea"
import { toast } from "~/components/ui/toast"
import { Can } from "~/features/access/can"
import { StatGrid, StatTile } from "~/features/dashboard/components/stat-tile"
import { WidgetCard } from "~/features/dashboard/components/widget-group"
import { displaySettingsQuery } from "~/features/settings/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"
import { todayIn } from "~/lib/format"
import { cn } from "~/lib/utils"

import {
  cancelReceipt,
  dailyCollectionQuery,
  feeKeys,
  headWiseQuery,
  paymentsQuery,
  receiptPdfUrl,
  type PaymentChannel,
  type PaymentRow,
} from "../api"

/**
 * `/dashboard/fees/payments`: a day's collection, head-wise and by mode,
 * and every receipt issued that day. Cancelling a receipt needs
 * `fees:cancel_receipt` and a reason, and is kept in the audit log.
 */
export function CollectionLog() {
  const t = useTranslations("fees.log")
  const f = useSchoolFormat()
  const display = useQuery(displaySettingsQuery())
  const today = todayIn(display.data?.locale.timeZone)
  const [picked, setPicked] = useState<string | null>(null)
  const date = picked ?? today
  const [page, setPage] = useState(1)
  const [cancelling, setCancelling] = useState<PaymentRow | null>(null)

  const daily = useQuery(dailyCollectionQuery(date))
  const heads = useQuery(headWiseQuery(date))
  const payments = useQuery(paymentsQuery(date, page))

  const total = (daily.data?.collectors ?? []).reduce((s, c) => s + c.total, 0)
  const count = (daily.data?.collectors ?? []).reduce((s, c) => s + c.count, 0)
  const byChannel = (daily.data?.collectors ?? []).reduce<
    Partial<Record<PaymentChannel, number>>
  >((acc, c) => {
    for (const [k, v] of Object.entries(c.byChannel)) {
      const key = k as PaymentChannel
      acc[key] = (acc[key] ?? 0) + (v ?? 0)
    }
    return acc
  }, {})
  const pages = payments.data?.meta.totalPages ?? 1

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 sm:max-w-48">
        <Label htmlFor="log-date">{t("date")}</Label>
        <Input
          id="log-date"
          type="date"
          value={date}
          max={today}
          onChange={(e) => {
            if (e.target.value) {
              setPicked(e.target.value)
              setPage(1)
            }
          }}
        />
      </div>

      {daily.isPending ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : (
        <StatGrid wide>
          <StatTile
            icon={<BanknoteIcon />}
            label={date === today ? t("collectedToday") : t("collected")}
            value={f.moneyShort(total)}
            hint={t("receipts", { count, n: f.number(count) })}
          />
          {(["cash", "upi", "cheque"] as const).map((c) => (
            <StatTile
              key={c}
              label={t(`byMode.${c}`)}
              value={f.moneyShort(byChannel[c] ?? 0)}
            />
          ))}
        </StatGrid>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-3">
          {payments.isPending ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : !payments.data?.items.length ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
                <EmptyDescription>{t("emptyBody")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("receipt")}</TableHead>
                    <TableHead>{t("student")}</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      {t("mode")}
                    </TableHead>
                    <TableHead className="text-right">{t("amount")}</TableHead>
                    <TableHead>
                      <span className="sr-only">{t("actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.data.items.map((p) => (
                    <PaymentLine
                      key={p.id}
                      payment={p}
                      onCancel={() => setCancelling(p)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {pages > 1 && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeftIcon data-icon="inline-start" />
                {t("previous")}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t("pageOf", { page: f.number(page), pages: f.number(pages) })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("next")}
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
            </div>
          )}
        </div>

        <WidgetCard title={t("headWise")}>
          {heads.isPending ? (
            <Skeleton className="h-32" />
          ) : !heads.data?.heads.length ? (
            <p className="text-sm text-muted-foreground">{t("noHeads")}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {heads.data.heads.map((h) => (
                <li key={h.head} className="flex justify-between gap-2">
                  <span className="truncate">{h.head}</span>
                  <span className="tabular-nums">{f.money(h.amount)}</span>
                </li>
              ))}
              <li className="flex justify-between gap-2 border-t pt-2 font-semibold">
                <span>{t("total")}</span>
                <span className="tabular-nums">
                  {f.money(heads.data.total)}
                </span>
              </li>
            </ul>
          )}
        </WidgetCard>
      </div>

      <CancelDialog payment={cancelling} onClose={() => setCancelling(null)} />
    </div>
  )
}

function PaymentLine({
  payment,
  onCancel,
}: {
  payment: PaymentRow
  onCancel: () => void
}) {
  const t = useTranslations("fees")
  const f = useSchoolFormat()
  const cancelled = payment.receipt?.status === "cancelled"
  const print = useMutation({
    mutationFn: () => receiptPdfUrl(payment.receipt!.id),
    onSuccess: (url) => window.open(url, "_blank", "noopener"),
    onError: () =>
      toast.add({ title: t("receipt.printFailed"), type: "error" }),
  })
  return (
    <TableRow className={cn(cancelled && "text-muted-foreground")}>
      <TableCell>
        <span className="flex flex-col">
          <span className="font-mono text-xs">{payment.receipt?.number}</span>
          <span className="text-xs text-muted-foreground">
            {f.dateTime(payment.receivedAt).split(" ").slice(1).join(" ")}
          </span>
        </span>
      </TableCell>
      <TableCell>
        <span className="flex flex-col">
          <span className="font-medium">{payment.student?.fullName}</span>
          {cancelled && (
            <Badge variant="destructive" className="w-fit">
              {t("log.cancelled")}
            </Badge>
          )}
        </span>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        {t(`channels.${payment.channel}`)}
      </TableCell>
      <TableCell
        className={cn(
          "text-right font-medium tabular-nums",
          cancelled && "line-through"
        )}
      >
        {f.money(payment.amount)}
      </TableCell>
      <TableCell className="text-right">
        {payment.receipt && (
          <span className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("log.print", { number: payment.receipt.number })}
              disabled={print.isPending}
              onClick={() => print.mutate()}
            >
              <PrinterIcon />
            </Button>
            {!cancelled && (
              <Can permission="fees:cancel_receipt">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("log.cancel", {
                    number: payment.receipt.number,
                  })}
                  onClick={onCancel}
                >
                  <XCircleIcon />
                </Button>
              </Can>
            )}
          </span>
        )}
      </TableCell>
    </TableRow>
  )
}

function CancelDialog({
  payment,
  onClose,
}: {
  payment: PaymentRow | null
  onClose: () => void
}) {
  const t = useTranslations("fees.log")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const [reason, setReason] = useState("")
  const cancel = useMutation({
    mutationFn: () => cancelReceipt(payment!.receipt!.id, reason.trim()),
    onSuccess: async () => {
      toast.add({
        title: t("cancelDone", { number: payment!.receipt!.number }),
        type: "success",
      })
      setReason("")
      onClose()
      await queryClient.invalidateQueries({ queryKey: feeKeys.all })
    },
    onError: (error) =>
      toast.add({
        title: t("cancelFailed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  return (
    <Dialog
      open={Boolean(payment)}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptIcon className="size-4" />
            {t("cancelTitle", { number: payment?.receipt?.number ?? "" })}
          </DialogTitle>
          <DialogDescription>
            {payment &&
              t("cancelBody", {
                amount: f.money(payment.amount),
                student: payment.student?.fullName ?? "",
              })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cancel-reason">{t("cancelReason")}</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("cancelReasonPlaceholder")}
            maxLength={500}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("keep")}
          </Button>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 5 || cancel.isPending}
            onClick={() => cancel.mutate()}
          >
            {cancel.isPending ? t("cancelling") : t("cancelConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
