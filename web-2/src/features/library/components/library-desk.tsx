"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BookPlusIcon, PlusIcon, SearchIcon, UndoIcon } from "lucide-react"
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
import { Skeleton } from "~/components/ui/skeleton"
import { toast } from "~/components/ui/toast"
import { Can } from "~/features/access/can"
import { WidgetCard } from "~/features/dashboard/components/widget-group"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"
import { cn } from "~/lib/utils"

import {
  addBook,
  addCopies,
  booksQuery,
  FINE_PER_DAY,
  issueBook,
  libraryKeys,
  loansQuery,
  returnBook,
  type LoanFilter,
} from "../api"

/** `/dashboard/library`: the issue desk, books out and the catalogue. */
export function LibraryDesk() {
  const t = useTranslations("library")
  const [tab, setTab] = useState<"desk" | "catalogue">("desk")
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={t("view")} className="flex gap-1.5">
        {(["desk", "catalogue"] as const).map((k) => (
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
      {tab === "desk" ? <Desk /> : <Catalogue />}
    </div>
  )
}

function useFail() {
  const t = useTranslations("library")
  return (error: unknown) =>
    toast.add({
      title: t("failed"),
      description: isApiError(error) ? error.message : undefined,
      type: "error",
    })
}

function Desk() {
  const t = useTranslations("library")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const fail = useFail()
  const [filter, setFilter] = useState<LoanFilter>("out")
  const loans = useQuery(loansQuery(filter))
  const [accession, setAccession] = useState("")
  const [student, setStudent] = useState("")
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: libraryKeys.all })
  const issue = useMutation({
    mutationFn: () => issueBook(accession.trim(), student.trim()),
    onSuccess: async (loan) => {
      toast.add({
        title: t("issued", { title: loan.title, name: loan.studentName }),
        description: t("dueOn", { date: f.date(loan.dueOn) }),
        type: "success",
      })
      setAccession("")
      await refresh()
    },
    onError: fail,
  })
  const ret = useMutation({
    mutationFn: (id: string) => returnBook(id),
    onSuccess: async (r) => {
      toast.add({
        title: t("returned"),
        description: r.fine
          ? t("fineBilled", {
              amount: f.money(r.fine),
              days: f.number(r.daysLate),
            })
          : undefined,
        type: "success",
      })
      await refresh()
    },
    onError: fail,
  })
  return (
    <div className="flex flex-col gap-4">
      <Can permission="library:manage">
        <WidgetCard
          title={t("issueTitle")}
          description={t("issueHint", { fine: f.money(FINE_PER_DAY) })}
        >
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (accession.trim() && student.trim()) issue.mutate()
            }}
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor="lib-acc">{t("accession")}</Label>
              <Input
                id="lib-acc"
                className="w-40"
                placeholder={t("accessionPlaceholder")}
                value={accession}
                onChange={(e) => setAccession(e.target.value.toUpperCase())}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="lib-student">{t("studentId")}</Label>
              <Input
                id="lib-student"
                className="w-40"
                value={student}
                onChange={(e) => setStudent(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={!accession.trim() || !student.trim() || issue.isPending}
            >
              {issue.isPending ? t("issuing") : t("issue")}
            </Button>
          </form>
        </WidgetCard>
      </Can>
      <div role="tablist" aria-label={t("loans")} className="flex gap-1.5">
        {(["out", "overdue", "returned"] as const).map((k) => (
          <Button
            key={k}
            role="tab"
            size="sm"
            aria-selected={filter === k}
            variant={filter === k ? "secondary" : "ghost"}
            onClick={() => setFilter(k)}
          >
            {t(`filters.${k}`)}
          </Button>
        ))}
      </div>
      {loans.isPending ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : !loans.data?.length ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t(`empty.${filter}`)}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {loans.data.map((l) => (
            <li
              key={l.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">
                  {l.title}{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    {l.accessionNo}
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {l.studentName} · {l.className} {l.sectionName} ·{" "}
                  {l.admissionNumber}
                </span>
              </span>
              <span
                className={cn(
                  "text-sm",
                  l.daysOverdue > 0 && "font-medium text-destructive"
                )}
              >
                {l.returnedOn
                  ? t("returnedOn", { date: f.date(l.returnedOn) })
                  : l.daysOverdue > 0
                    ? t("overdueBy", {
                        n: f.number(l.daysOverdue),
                        fine: f.money(l.daysOverdue * FINE_PER_DAY),
                      })
                    : t("dueOn", { date: f.date(l.dueOn) })}
              </span>
              {l.returnedOn && l.fine > 0 && (
                <Badge variant="outline">
                  {t("fine", { amount: f.money(l.fine) })}
                </Badge>
              )}
              {!l.returnedOn && (
                <Can permission="library:manage">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={ret.isPending}
                    onClick={() => ret.mutate(l.id)}
                  >
                    <UndoIcon data-icon="inline-start" />
                    {t("return")}
                  </Button>
                </Can>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Catalogue() {
  const t = useTranslations("library")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const fail = useFail()
  const [q, setQ] = useState("")
  const books = useQuery(booksQuery(q.trim()))
  const [adding, setAdding] = useState(false)
  const more = useMutation({
    mutationFn: (id: string) => addCopies(id, 1),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: libraryKeys.all }),
    onError: fail,
  })
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={t("search")}
            placeholder={t("search")}
            className="ps-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Can permission="library:manage">
          <Button className="ms-auto" onClick={() => setAdding(true)}>
            <BookPlusIcon data-icon="inline-start" />
            {t("addBook")}
          </Button>
        </Can>
      </div>
      {books.isPending ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {(books.data ?? []).map((b) => (
            <li
              key={b.id}
              className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{b.title}</span>
                <span className="text-sm text-muted-foreground">
                  {[b.author, b.category].filter(Boolean).join(" · ")}
                </span>
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {b.accessions.join(", ")}
                </span>
              </span>
              <Badge variant={b.available ? "secondary" : "outline"}>
                {t("available", {
                  available: f.number(b.available),
                  total: f.number(b.total),
                })}
              </Badge>
              <Can permission="library:manage">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={more.isPending}
                  onClick={() => more.mutate(b.id)}
                >
                  <PlusIcon data-icon="inline-start" />
                  {t("addCopy")}
                </Button>
              </Can>
            </li>
          ))}
        </ul>
      )}
      {adding && <AddBookDialog onClose={() => setAdding(false)} />}
    </div>
  )
}

function AddBookDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("library")
  const queryClient = useQueryClient()
  const fail = useFail()
  const [v, setV] = useState({
    title: "",
    author: "",
    category: "",
    isbn: "",
    copies: "1",
  })
  const save = useMutation({
    mutationFn: () =>
      addBook({
        title: v.title.trim(),
        author: v.author.trim() || null,
        category: v.category.trim() || null,
        isbn: v.isbn.trim() || null,
        copies: Math.max(1, Math.min(200, Number(v.copies) || 1)),
      }),
    onSuccess: async (b) => {
      toast.add({
        title: t("bookAdded", { list: b.accessions.join(", ") }),
        type: "success",
      })
      await queryClient.invalidateQueries({ queryKey: libraryKeys.all })
      onClose()
    },
    onError: fail,
  })
  const field = (k: keyof typeof v, label: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`bk-${k}`}>{label}</Label>
      <Input
        id={`bk-${k}`}
        value={v[k]}
        inputMode={k === "copies" ? "numeric" : undefined}
        onChange={(e) => setV((o) => ({ ...o, [k]: e.target.value }))}
      />
    </div>
  )
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("addBook")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">{field("title", t("bookTitle"))}</div>
          {field("author", t("author"))}
          {field("category", t("category"))}
          {field("isbn", t("isbn"))}
          {field("copies", t("copies"))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!v.title.trim() || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
