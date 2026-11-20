"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CheckCircle2Icon,
  PrinterIcon,
  SearchIcon,
  UserRoundIcon,
  XIcon,
} from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { InitialsAvatar } from "~/components/common/initials-avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "~/components/ui/input-group"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Skeleton } from "~/components/ui/skeleton"
import { toast } from "~/components/ui/toast"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import {
  feeStatementQuery,
  placementLabel,
  studentKeys,
  studentOverviewQuery,
  studentsQuery,
  type FeeStatement,
  type StudentOverview,
} from "~/features/students/api"
import { useDebouncedValue } from "~/hooks/use-debounced-value"
import { isApiError } from "~/lib/api/errors"
import { currencySymbol } from "~/lib/format"
import { cn } from "~/lib/utils"

import {
  collectPayment,
  COUNTER_CHANNELS,
  feeKeys,
  receiptPdfUrl,
  type PaymentChannel,
  type Receipt,
} from "../api"

/**
 * `/dashboard/fees/collect`: find the student, see what is due, take a
 * full or part payment and hand over the receipt. `?student=<id>` opens a
 * student directly (the "Collect fee" button on their record).
 */
export function CollectFees() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const studentId = params.get("student")
  const [receipt, setReceipt] = useState<Receipt | null>(null)

  const choose = (id: string | null) => {
    setReceipt(null)
    router.replace(id ? `${pathname}?student=${id}` : pathname, {
      scroll: false,
    })
  }

  if (receipt) {
    return (
      <ReceiptPanel
        receipt={receipt}
        onNext={() => choose(null)}
        onSameStudent={() => setReceipt(null)}
      />
    )
  }
  return studentId ? (
    <StudentDues
      key={studentId}
      studentId={studentId}
      onClear={() => choose(null)}
      onPaid={setReceipt}
    />
  ) : (
    <StudentSearch onPick={choose} />
  )
}

function StudentSearch({ onPick }: { onPick: (id: string) => void }) {
  const t = useTranslations("fees.collect")
  const [search, setSearch] = useState("")
  const q = useDebouncedValue(search.trim(), 300)
  const results = useQuery({
    ...studentsQuery({ q }),
    enabled: q.length >= 2,
  })

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <Label htmlFor="collect-search">{t("findStudent")}</Label>
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          id="collect-search"
          type="search"
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
        />
      </InputGroup>
      {q.length >= 2 &&
        (results.isPending ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : results.data?.items.length ? (
          <ul className="flex flex-col divide-y rounded-xl border bg-card">
            {results.data.items.slice(0, 10).map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onPick(s.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none hover:bg-muted focus-visible:bg-muted"
                >
                  <InitialsAvatar name={s.fullName} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{s.fullName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {[placementLabel(s.placement), s.admissionNumber]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noMatch")}</p>
        ))}
    </div>
  )
}

function StudentDues({
  studentId,
  onClear,
  onPaid,
}: {
  studentId: string
  onClear: () => void
  onPaid: (receipt: Receipt) => void
}) {
  const overview = useQuery(studentOverviewQuery(studentId))
  const statement = useQuery(feeStatementQuery(studentId))

  if (overview.isPending || statement.isPending) {
    return <Skeleton className="h-80 max-w-3xl rounded-xl" />
  }
  if (overview.isError || statement.isError) {
    return <StudentSearch onPick={() => onClear()} />
  }
  return (
    <PayForm
      student={overview.data}
      statement={statement.data}
      onClear={onClear}
      onPaid={onPaid}
    />
  )
}

function PayForm({
  student,
  statement,
  onClear,
  onPaid,
}: {
  student: StudentOverview
  statement: FeeStatement
  onClear: () => void
  onPaid: (receipt: Receipt) => void
}) {
  const t = useTranslations("fees")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const due = statement.outstanding
  const [amount, setAmount] = useState(due > 0 ? String(due / 100) : "")
  const [channel, setChannel] = useState<PaymentChannel>("cash")
  const [reference, setReference] = useState("")
  // One key per attempt: a retry after a network error is the same payment.
  const [attempt, setAttempt] = useState(() => crypto.randomUUID())

  const open = statement.invoices
    .filter((i) => i.status === "open" || i.status === "partially_paid")
    .sort((a, b) => a.period.localeCompare(b.period))
  const paise = Math.round(Number(amount) * 100)
  const valid = Number.isFinite(paise) && paise > 0 && paise <= due
  const enrollment = student.currentEnrollment

  const pay = useMutation({
    mutationFn: () =>
      collectPayment(
        {
          studentId: student.profile.id,
          channel,
          amount: paise,
          ...(reference.trim() ? { reference: reference.trim() } : {}),
        },
        attempt
      ),
    onSuccess: async (receipt) => {
      setAttempt(crypto.randomUUID())
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: feeKeys.all }),
        queryClient.invalidateQueries({
          queryKey: studentKeys.statement(student.profile.id),
        }),
      ])
      onPaid(receipt)
    },
    onError: (error) =>
      toast.add({
        title: t("collect.failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })

  return (
    <div className="grid max-w-5xl gap-4 lg:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <InitialsAvatar name={student.profile.fullName} className="size-10" />
          <div className="flex min-w-0 flex-1 flex-col">
            <CardTitle>{student.profile.fullName}</CardTitle>
            <CardDescription>
              {[
                enrollment &&
                  `${enrollment.schoolClass.name} ${enrollment.section.name}`,
                student.profile.admissionNumber,
              ]
                .filter(Boolean)
                .join(" · ")}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <XIcon data-icon="inline-start" />
            {t("collect.change")}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">{t("collect.dueTitle")}</h3>
          {open.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2Icon className="size-4 text-primary" />
              {t("collect.nothingDue")}
            </p>
          ) : (
            <ul className="flex flex-col divide-y rounded-lg border">
              {open.map((inv) => (
                <li key={inv.id} className="flex flex-col gap-1 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {f.month(inv.period)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t("collect.dueOn", { date: f.date(inv.dueDate) })}
                    </span>
                  </div>
                  {inv.lines
                    .filter((l) => l.outstanding > 0)
                    .map((l) => (
                      <div
                        key={l.id}
                        className={cn(
                          "flex justify-between gap-2 text-sm",
                          l.kind === "fine" && "text-destructive"
                        )}
                      >
                        <span className="truncate text-muted-foreground">
                          {l.description}
                        </span>
                        <span className="tabular-nums">
                          {f.money(l.outstanding)}
                        </span>
                      </div>
                    ))}
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between border-t pt-3 font-semibold">
            <span>{t("collect.totalDue")}</span>
            <span className="tabular-nums">{f.money(due)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("collect.payTitle")}</CardTitle>
          <CardDescription>{t("collect.payHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (valid && !pay.isPending) pay.mutate()
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pay-amount">{t("collect.amount")}</Label>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>{currencySymbol(f.currency)}</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="pay-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) =>
                    setAmount(e.target.value.replace(/[^\d.]/g, ""))
                  }
                  aria-invalid={amount !== "" && !valid}
                  className="text-lg font-semibold tabular-nums"
                />
              </InputGroup>
              {amount !== "" && paise > due && (
                <p className="text-xs text-destructive">
                  {t("collect.tooMuch", { due: f.money(due) })}
                </p>
              )}
              {valid && paise < due && (
                <p className="text-xs text-muted-foreground">
                  {t("collect.partial", { left: f.money(due - paise) })}
                </p>
              )}
            </div>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-sm font-medium">
                {t("collect.mode")}
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {COUNTER_CHANNELS.map((c) => (
                  <label
                    key={c}
                    className={cn(
                      "cursor-pointer rounded-lg border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring/40"
                    )}
                  >
                    <input
                      type="radio"
                      name="pay-mode"
                      value={c}
                      checked={channel === c}
                      onChange={() => setChannel(c)}
                      className="sr-only"
                    />
                    {t(`channels.${c}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            {channel !== "cash" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pay-reference">
                  {t(`collect.reference.${channel}`)}
                </Label>
                <Input
                  id="pay-reference"
                  value={reference}
                  maxLength={80}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
            )}
            <Button type="submit" size="lg" disabled={!valid || pay.isPending}>
              {pay.isPending
                ? t("collect.collecting")
                : t("collect.submit", {
                    amount: valid ? f.money(paise) : "",
                  })}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

/** The receipt just issued: what it covered, print it, next payment. */
function ReceiptPanel({
  receipt,
  onNext,
  onSameStudent,
}: {
  receipt: Receipt
  onNext: () => void
  onSameStudent: () => void
}) {
  const t = useTranslations("fees")
  const f = useSchoolFormat()
  const print = useMutation({
    mutationFn: (paper: "A4" | "80mm") => receiptPdfUrl(receipt.id, paper),
    onSuccess: (url) => window.open(url, "_blank", "noopener"),
    onError: () =>
      toast.add({ title: t("receipt.printFailed"), type: "error" }),
  })
  const student = receipt.allocations[0]?.studentName

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">
          <CheckCircle2Icon className="size-5" />
          <CardTitle>{t("receipt.issued")}</CardTitle>
        </div>
        <CardDescription>
          {t("receipt.summary", {
            number: receipt.number,
            mode: t(`channels.${receipt.payment.channel}`),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserRoundIcon className="size-4" />
            {student}
          </span>
          <span className="text-3xl font-semibold tabular-nums">
            {f.money(receipt.payment.amount)}
          </span>
        </div>
        <ul className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3 text-sm">
          {receipt.allocations.map((a) => (
            <li key={a.id} className="flex justify-between gap-2">
              <span className="text-muted-foreground">
                {a.description} · {f.month(a.period)}
              </span>
              <span className="tabular-nums">{f.money(a.amount)}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => print.mutate("A4")} disabled={print.isPending}>
            <PrinterIcon data-icon="inline-start" />
            {print.isPending ? t("receipt.preparing") : t("receipt.printA4")}
          </Button>
          <Button
            variant="outline"
            onClick={() => print.mutate("80mm")}
            disabled={print.isPending}
          >
            {t("receipt.printThermal")}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button variant="secondary" onClick={onNext}>
            {t("receipt.next")}
          </Button>
          <Button variant="ghost" onClick={onSameStudent}>
            {t("receipt.sameStudent")}
          </Button>
          <Badge variant="outline" className="ml-auto self-center">
            {f.dateTime(receipt.issuedAt)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
