"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { CheckCircle2Icon, DownloadIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"
import { toast } from "~/components/ui/toast"
import { StatGrid, StatTile } from "~/features/dashboard/components/stat-tile"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { cn } from "~/lib/utils"

import {
  childFeesQuery,
  portalPaymentsQuery,
  portalReceiptUrl,
  type PortalChild,
  type PortalPayment,
} from "../api"
import { ChildGate, PageFailed } from "./child-gate"

/** `/student/fees`: what is due, every bill, and receipts to download. */
export function ChildFees() {
  const t = useTranslations("portal.pages")
  return (
    <ChildGate title={(name) => t("feesTitle", { name })}>
      {(child) => <FeesBody key={child.studentId} child={child} />}
    </ChildGate>
  )
}

function FeesBody({ child }: { child: PortalChild }) {
  const t = useTranslations("portal.pages")
  const f = useSchoolFormat()
  const fees = useQuery(childFeesQuery(child.studentId))
  const payments = useQuery(portalPaymentsQuery())

  if (fees.isPending) return <Skeleton className="h-64 rounded-xl" />
  if (fees.isError) return <PageFailed retry={fees.refetch} />
  const s = fees.data
  const open = s.invoices
    .filter((i) => i.status === "open" || i.status === "partially_paid")
    .sort((a, b) => a.period.localeCompare(b.period))
  const bills = s.invoices
    .filter((i) => i.status !== "cancelled")
    .sort((a, b) => b.period.localeCompare(a.period))

  return (
    <div className="flex flex-col gap-4">
      <StatGrid>
        <StatTile
          label={t("dueNow")}
          value={s.outstanding > 0 ? f.moneyShort(s.outstanding) : t("noDue")}
          hint={
            open[0]
              ? t("oldestDue", { date: f.date(open[0].dueDate) })
              : undefined
          }
        />
        <StatTile label={t("paidSession")} value={f.moneyShort(s.collected)} />
        {s.discounts > 0 && (
          <StatTile label={t("concession")} value={f.moneyShort(s.discounts)} />
        )}
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{t("billsTitle")}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {bills.map((inv) => {
                const owed = inv.lines.reduce((n, l) => n + l.outstanding, 0)
                return (
                  <li
                    key={inv.id}
                    className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-medium">
                        {f.month(inv.period)}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {inv.lines.map((l) => l.description).join(", ")}
                      </span>
                    </span>
                    <span className="flex flex-col items-end">
                      <span className="text-sm tabular-nums">
                        {f.money(inv.netTotal)}
                      </span>
                      {owed > 0 ? (
                        <span className="text-xs text-destructive tabular-nums">
                          {t("owed", { amount: f.money(owed) })}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckCircle2Icon className="size-3" />
                          {t("paid")}
                        </span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{t("receiptsTitle")}</h2>
            </CardTitle>
            <CardDescription>{t("receiptsHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            {payments.isPending ? (
              <Skeleton className="h-40" />
            ) : !payments.data?.length ? (
              <p className="text-sm text-muted-foreground">{t("noReceipts")}</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {payments.data.map((p) => (
                  <ReceiptRow key={p.id} payment={p} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ReceiptRow({ payment }: { payment: PortalPayment }) {
  const t = useTranslations("portal.pages")
  const f = useSchoolFormat()
  const cancelled = payment.receiptStatus === "cancelled"
  const download = useMutation({
    mutationFn: () => portalReceiptUrl(payment.receiptId!),
    onSuccess: (url) => window.open(url, "_blank", "noopener"),
    onError: () => toast.add({ title: t("receiptFailed"), type: "error" }),
  })
  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-mono text-xs">{payment.receiptNumber}</span>
        <span className="text-xs text-muted-foreground">
          {f.date(payment.receivedAt)}
        </span>
      </span>
      {cancelled && <Badge variant="destructive">{t("cancelled")}</Badge>}
      <span
        className={cn(
          "text-sm font-medium tabular-nums",
          cancelled && "text-muted-foreground line-through"
        )}
      >
        {f.money(payment.amount)}
      </span>
      {payment.receiptId && !cancelled && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("downloadReceipt", {
            number: payment.receiptNumber ?? "",
          })}
          disabled={download.isPending}
          onClick={() => download.mutate()}
        >
          <DownloadIcon />
        </Button>
      )}
    </li>
  )
}
