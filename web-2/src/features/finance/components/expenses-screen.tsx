"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BanIcon, PlusIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Pager } from "~/features/shell/components/pager"
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
import { displaySettingsQuery } from "~/features/settings/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"
import { todayIn } from "~/lib/format"
import { cn } from "~/lib/utils"

import {
  ACCOUNTS,
  categoriesQuery,
  createCategory,
  createExpense,
  expensesQuery,
  financeKeys,
  voidExpense,
  type Account,
  type Expense,
} from "../api"

/** First day of the month of `today` (`YYYY-MM-DD`). */
const monthStart = (today: string) => `${today.slice(0, 7)}-01`

/**
 * `/dashboard/expenses`: money the school spends, by category, paid from
 * cash or bank. Each expense posts to the book; a wrong one is voided.
 */
export function ExpensesScreen() {
  const t = useTranslations("expensesScreen")
  const f = useSchoolFormat()
  const display = useQuery(displaySettingsQuery())
  const today = todayIn(display.data?.locale.timeZone)
  const categories = useQuery(categoriesQuery())
  const [categoryId, setCategoryId] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [page, setPage] = useState(1)
  const range = { from: from || monthStart(today), to: to || today }
  const list = useQuery(expensesQuery({ categoryId, ...range, page }))
  const rows = list.data?.items ?? []
  const total = rows
    .filter((e) => !e.voidedAt)
    .reduce((n, e) => n + e.amount, 0)
  const [adding, setAdding] = useState(false)
  const [voiding, setVoiding] = useState<Expense | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ex-from">{t("from")}</Label>
          <Input
            id="ex-from"
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => {
              setFrom(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ex-to">{t("to")}</Label>
          <Input
            id="ex-to"
            type="date"
            value={range.to}
            min={range.from}
            onChange={(e) => {
              setTo(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <NativeSelect
          aria-label={t("category")}
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value)
            setPage(1)
          }}
        >
          <NativeSelectOption value="">{t("allCategories")}</NativeSelectOption>
          {(categories.data ?? []).map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Can permission="expenses:manage">
          <Button className="ms-auto" onClick={() => setAdding(true)}>
            <PlusIcon data-icon="inline-start" />
            {t("add")}
          </Button>
        </Can>
      </div>

      {list.isPending ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : rows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("empty")}</EmptyTitle>
            <EmptyDescription>{t("emptyBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <p className="text-sm">
            {t("total", {
              amount: f.money(total),
              count: rows.length,
              n: f.number(rows.length),
            })}
          </p>
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("voucher")}</TableHead>
                  <TableHead>{t("category")}</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t("note")}
                  </TableHead>
                  <TableHead>{t("paidFrom")}</TableHead>
                  <TableHead className="text-right">{t("amount")}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t("actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <TableRow
                    key={e.id}
                    className={cn(e.voidedAt && "opacity-60")}
                  >
                    <TableCell className="whitespace-nowrap">
                      {f.date(e.date)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {e.voucherNo}
                      {e.voidedAt && (
                        <Badge variant="destructive" className="ms-2">
                          {t("void")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{e.category?.name ?? "—"}</TableCell>
                    <TableCell className="hidden max-w-64 truncate text-sm lg:table-cell">
                      {e.voidedAt
                        ? t("voidedBecause", { reason: e.voidReason ?? "" })
                        : (e.note ?? "—")}
                    </TableCell>
                    <TableCell>{t(`accounts.${e.paidFrom}`)}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium tabular-nums",
                        e.voidedAt && "line-through"
                      )}
                    >
                      {f.money(e.amount)}
                    </TableCell>
                    <TableCell className="w-0 text-right">
                      {!e.voidedAt && (
                        <Can permission="expenses:manage">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("voidNamed", {
                              voucher: e.voucherNo,
                            })}
                            onClick={() => setVoiding(e)}
                          >
                            <BanIcon />
                          </Button>
                        </Can>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      <Pager
        page={page}
        pages={list.data?.meta.totalPages ?? 1}
        onPage={setPage}
      />
      {adding && (
        <ExpenseDialog today={today} onClose={() => setAdding(false)} />
      )}
      {voiding && (
        <VoidDialog expense={voiding} onClose={() => setVoiding(null)} />
      )}
    </div>
  )
}

function ExpenseDialog({
  today,
  onClose,
}: {
  today: string
  onClose: () => void
}) {
  const t = useTranslations("expensesScreen")
  const queryClient = useQueryClient()
  const categories = useQuery(categoriesQuery())
  const [categoryId, setCategoryId] = useState("")
  const [newCategory, setNewCategory] = useState("")
  const [amount, setAmount] = useState("")
  const [paidFrom, setPaidFrom] = useState<Account>("cash")
  const [date, setDate] = useState(today)
  const [note, setNote] = useState("")
  const rupees = Number(amount)
  const save = useMutation({
    mutationFn: async () => {
      const category =
        categoryId === "new"
          ? (await createCategory(newCategory.trim())).id
          : categoryId
      return createExpense({
        categoryId: category,
        amount: Math.round(rupees * 100),
        paidFrom,
        date,
        note: note.trim() || undefined,
      })
    },
    onSuccess: async (e) => {
      toast.add({
        title: t("added", { voucher: e.voucherNo }),
        type: "success",
      })
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
  const valid =
    (categoryId === "new" ? newCategory.trim() : categoryId) &&
    rupees > 0 &&
    date

  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("addTitle")}</DialogTitle>
          <DialogDescription>{t("addHint")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ex-cat">{t("category")}</Label>
            <NativeSelect
              id="ex-cat"
              className="w-full"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <NativeSelectOption value="">—</NativeSelectOption>
              {(categories.data ?? []).map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name}
                </NativeSelectOption>
              ))}
              <NativeSelectOption value="new">
                {t("newCategory")}
              </NativeSelectOption>
            </NativeSelect>
          </div>
          {categoryId === "new" && (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="ex-newcat">{t("categoryName")}</Label>
              <Input
                id="ex-newcat"
                maxLength={120}
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ex-amount">{t("amountRupees")}</Label>
            <Input
              id="ex-amount"
              type="number"
              inputMode="decimal"
              min={1}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ex-date">{t("date")}</Label>
            <Input
              id="ex-date"
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ex-from-acc">{t("paidFrom")}</Label>
            <NativeSelect
              id="ex-from-acc"
              className="w-full"
              value={paidFrom}
              onChange={(e) => setPaidFrom(e.target.value as Account)}
            >
              {ACCOUNTS.map((a) => (
                <NativeSelectOption key={a} value={a}>
                  {t(`accounts.${a}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ex-note">{t("note")}</Label>
            <Textarea
              id="ex-note"
              rows={2}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!valid || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function VoidDialog({
  expense,
  onClose,
}: {
  expense: Expense
  onClose: () => void
}) {
  const t = useTranslations("expensesScreen")
  const queryClient = useQueryClient()
  const [reason, setReason] = useState("")
  const run = useMutation({
    mutationFn: () => voidExpense(expense.id, reason.trim()),
    onSuccess: async () => {
      toast.add({ title: t("voided"), type: "success" })
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
  return (
    <Dialog open onOpenChange={(o) => !o && !run.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("voidTitle", { voucher: expense.voucherNo })}
          </DialogTitle>
          <DialogDescription>{t("voidBody")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ex-reason">{t("reason")}</Label>
          <Textarea
            id="ex-reason"
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || run.isPending}
            onClick={() => run.mutate()}
          >
            {t("voidConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
