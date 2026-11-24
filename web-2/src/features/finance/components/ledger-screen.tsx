"use client"

import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useState } from "react"

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
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { displaySettingsQuery } from "~/features/settings/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { todayIn } from "~/lib/format"

import { ACCOUNTS, bookQuery, type Account } from "../api"

/**
 * `/dashboard/ledger`: the cash book and the bank book. Opening balance,
 * every receipt, refund and expense in date order, and the closing balance.
 */
export function LedgerScreen() {
  const t = useTranslations("ledgerScreen")
  const f = useSchoolFormat()
  const display = useQuery(displaySettingsQuery())
  const today = todayIn(display.data?.locale.timeZone)
  const [account, setAccount] = useState<Account>("cash")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const range = { from: from || `${today.slice(0, 7)}-01`, to: to || today }
  const book = useQuery(bookQuery(account, range.from, range.to))
  const b = book.data

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Tabs value={account} onValueChange={(v) => setAccount(v as Account)}>
          <TabsList>
            {ACCOUNTS.map((a) => (
              <TabsTrigger key={a} value={a}>
                {t(`accounts.${a}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lg-from">{t("from")}</Label>
          <Input
            id="lg-from"
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lg-to">{t("to")}</Label>
          <Input
            id="lg-to"
            type="date"
            value={range.to}
            min={range.from}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      {book.isPending || !b ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {(
              [
                ["opening", b.opening],
                ["income", b.income],
                ["expense", b.expense],
                ["closing", b.closing],
              ] as const
            ).map(([key, value]) => (
              <div key={key} className="rounded-xl border bg-card p-4">
                <dt className="text-sm text-muted-foreground">{t(key)}</dt>
                <dd className="text-xl font-semibold tabular-nums">
                  {f.money(value)}
                </dd>
              </div>
            ))}
          </dl>
          {b.entries.length === 0 ? (
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
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("particulars")}</TableHead>
                    <TableHead className="text-right">{t("in")}</TableHead>
                    <TableHead className="text-right">{t("out")}</TableHead>
                    <TableHead className="text-right">{t("balance")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {b.entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap">
                        {f.date(e.date)}
                      </TableCell>
                      <TableCell className="text-sm">{e.description}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {e.income ? f.money(e.income) : ""}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {e.expense ? f.money(e.expense) : ""}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {f.money(e.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
