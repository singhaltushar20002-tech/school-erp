"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react"
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group"
import { Label } from "~/components/ui/label"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { Skeleton } from "~/components/ui/skeleton"
import { toast } from "~/components/ui/toast"
import { Can } from "~/features/access/can"
import { displaySettingsQuery } from "~/features/settings/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { placementLabel, studentsQuery } from "~/features/students/api"
import { useDebouncedValue } from "~/hooks/use-debounced-value"
import { isApiError } from "~/lib/api/errors"
import { todayIn } from "~/lib/format"
import { cn } from "~/lib/utils"

import {
  decideStudentDiscount,
  discountTypesQuery,
  percentOf,
  requestStudentDiscount,
  setupKeys,
  studentDiscountsQuery,
  type ApprovalStatus,
  type StudentDiscount,
} from "../setup-api"

const FILTERS: (ApprovalStatus | "all")[] = [
  "pending",
  "approved",
  "rejected",
  "all",
]

/**
 * `/dashboard/fees/approvals`: concessions given to students (sibling,
 * staff ward, RTE…). The accountant asks, someone with
 * `fees:approve_waiver` approves; bills from the start month take it.
 */
export function ConcessionApprovals() {
  const t = useTranslations("fees.approvals")
  const [status, setStatus] = useState<ApprovalStatus | "all">("pending")
  const [giving, setGiving] = useState(false)
  const list = useQuery(studentDiscountsQuery(status))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label={t("filter")}
          className="flex flex-wrap gap-1.5"
        >
          {FILTERS.map((s) => (
            <Button
              key={s}
              role="tab"
              aria-selected={status === s}
              size="sm"
              variant={status === s ? "default" : "outline"}
              onClick={() => setStatus(s)}
            >
              {t(`filters.${s}`)}
            </Button>
          ))}
        </div>
        <Can permission="fees:adjust">
          <Button onClick={() => setGiving(true)}>
            <PlusIcon data-icon="inline-start" />
            {t("give")}
          </Button>
        </Can>
      </div>

      {list.isPending ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : !list.data?.length ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("emptyBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {list.data
            .slice()
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((d) => (
              <ConcessionRow key={d.id} item={d} />
            ))}
        </ul>
      )}
      {giving && <GiveDialog onClose={() => setGiving(false)} />}
    </div>
  )
}

function ConcessionRow({ item }: { item: StudentDiscount }) {
  const t = useTranslations("fees.approvals")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const decide = useMutation({
    mutationFn: (d: "approve" | "reject") => decideStudentDiscount(item.id, d),
    onSuccess: async (_, d) => {
      toast.add({
        title: t(d === "approve" ? "approved" : "rejected", {
          name: item.student.fullName,
        }),
        type: "success",
      })
      await queryClient.invalidateQueries({ queryKey: setupKeys.all })
    },
    onError: (error) =>
      toast.add({
        title: t("decideFailed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  const type = item.discountType
  const value =
    type.kind === "percent"
      ? `${percentOf(item.valueOverride ?? type.value)}%`
      : f.moneyShort(item.valueOverride ?? type.value)
  return (
    <li className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium">
          {item.student.fullName}
          <span className="ml-2 font-mono text-xs text-muted-foreground">
            {item.student.admissionNumber}
          </span>
        </span>
        <span className="text-sm text-muted-foreground">
          {t("summary", {
            type: type.name,
            value,
            from: f.month(item.fromPeriod),
          })}
        </span>
        {item.reason && <span className="text-sm">{item.reason}</span>}
      </div>
      {item.status === "pending" ? (
        <Can
          permission="fees:approve_waiver"
          fallback={<Badge variant="outline">{t("status.pending")}</Badge>}
        >
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={decide.isPending}
              onClick={() => decide.mutate("approve")}
            >
              <CheckIcon data-icon="inline-start" />
              {t("approve")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={decide.isPending}
              onClick={() => decide.mutate("reject")}
            >
              <XIcon data-icon="inline-start" />
              {t("reject")}
            </Button>
          </div>
        </Can>
      ) : (
        <Badge
          variant={item.status === "approved" ? "secondary" : "destructive"}
        >
          {t(`status.${item.status}`)}
        </Badge>
      )}
    </li>
  )
}

function GiveDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("fees.approvals")
  const queryClient = useQueryClient()
  const display = useQuery(displaySettingsQuery())
  const month = todayIn(display.data?.locale.timeZone).slice(0, 7)
  const types = useQuery(discountTypesQuery())
  const [search, setSearch] = useState("")
  const q = useDebouncedValue(search.trim(), 300)
  const results = useQuery({ ...studentsQuery({ q }), enabled: q.length >= 2 })
  const [student, setStudent] = useState<{ id: string; name: string } | null>(
    null
  )
  const [typeId, setTypeId] = useState("")
  const [from, setFrom] = useState(month)
  const [reason, setReason] = useState("")
  const send = useMutation({
    mutationFn: () =>
      requestStudentDiscount({
        studentId: student!.id,
        discountTypeId: typeId,
        fromPeriod: from,
        reason: reason.trim() || undefined,
      }),
    onSuccess: async () => {
      toast.add({
        title: t("requested", { name: student!.name }),
        type: "success",
      })
      await queryClient.invalidateQueries({ queryKey: setupKeys.all })
      onClose()
    },
    onError: (error) =>
      toast.add({
        title: t("requestFailed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  const active = (types.data ?? []).filter((d) => d.isActive)
  const valid = Boolean(student && typeId && /^\d{4}-\d{2}$/.test(from))

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("give")}</DialogTitle>
          <DialogDescription>{t("giveHint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {student ? (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="font-medium">{student.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStudent(null)}
              >
                {t("change")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="give-search">{t("student")}</Label>
              <InputGroup>
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput
                  id="give-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                />
              </InputGroup>
              {q.length >= 2 && (
                <ul className="max-h-48 overflow-y-auto rounded-lg border">
                  {(results.data?.items ?? []).slice(0, 8).map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() =>
                          setStudent({ id: s.id, name: s.fullName })
                        }
                      >
                        <span>{s.fullName}</span>
                        <span className="text-muted-foreground">
                          {placementLabel(s.placement)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="give-type">{t("type")}</Label>
            <NativeSelect
              id="give-type"
              className="w-full"
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
            >
              <NativeSelectOption value="" disabled>
                {t("pickType")}
              </NativeSelectOption>
              {active.map((d) => (
                <NativeSelectOption key={d.id} value={d.id}>
                  {d.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="give-from">{t("fromMonth")}</Label>
            <Input
              id="give-from"
              type="month"
              className={cn("max-w-48")}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="give-reason">{t("reason")}</Label>
            <Input
              id="give-reason"
              value={reason}
              maxLength={200}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reasonPlaceholder")}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!valid || send.isPending}
            onClick={() => send.mutate()}
          >
            {send.isPending ? t("sending") : t("send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
