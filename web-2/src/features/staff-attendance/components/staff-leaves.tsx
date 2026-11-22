"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"
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
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { Skeleton } from "~/components/ui/skeleton"
import { toast } from "~/components/ui/toast"
import { Can } from "~/features/access/can"
import { displaySettingsQuery } from "~/features/settings/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"
import { todayIn } from "~/lib/format"

import {
  addStaffLeave,
  decideStaffLeave,
  LEAVE_TYPES,
  staffDayQuery,
  staffKeys,
  staffLeavesQuery,
  type LeaveType,
} from "../api"

const TABS = ["pending", "approved", "rejected"] as const

/** `/dashboard/staff/leave`: staff leave, recorded and approved. */
export function StaffLeaves() {
  const t = useTranslations("staffLeave")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending")
  const [adding, setAdding] = useState(false)
  const list = useQuery(staffLeavesQuery(tab))
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      decideStaffLeave(id, approve),
    onSuccess: async (_, v) => {
      toast.add({
        title: v.approve ? t("approved") : t("rejected"),
        type: "success",
      })
      await queryClient.invalidateQueries({ queryKey: staffKeys.all })
    },
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label={t("status")} className="flex gap-1.5">
          {TABS.map((s) => (
            <Button
              key={s}
              role="tab"
              size="sm"
              aria-selected={tab === s}
              variant={tab === s ? "default" : "outline"}
              onClick={() => setTab(s)}
            >
              {t(`tabs.${s}`)}
            </Button>
          ))}
        </div>
        <Can permission="staff_leaves:approve">
          <Button className="ms-auto" onClick={() => setAdding(true)}>
            <PlusIcon data-icon="inline-start" />
            {t("add")}
          </Button>
        </Can>
      </div>
      {list.isPending ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : !list.data?.length ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t(`empty.${tab}`)}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {list.data.map((l) => (
            <li
              key={l.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">
                  {l.employeeName}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {l.designation ?? ""}
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {l.fromDate === l.toDate
                    ? f.date(l.fromDate)
                    : t("range", {
                        from: f.date(l.fromDate),
                        to: f.date(l.toDate),
                      })}
                  {l.reason ? ` · ${l.reason}` : ""}
                </span>
              </span>
              <Badge
                variant={l.leaveType === "unpaid" ? "outline" : "secondary"}
              >
                {t(`types.${l.leaveType}`)}
              </Badge>
              {l.status === "pending" && (
                <Can permission="staff_leaves:approve">
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={decide.isPending}
                      onClick={() =>
                        decide.mutate({ id: l.id, approve: false })
                      }
                    >
                      {t("reject")}
                    </Button>
                    <Button
                      size="sm"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: l.id, approve: true })}
                    >
                      {t("approve")}
                    </Button>
                  </div>
                </Can>
              )}
            </li>
          ))}
        </ul>
      )}
      {adding && <AddLeaveDialog onClose={() => setAdding(false)} />}
    </div>
  )
}

function AddLeaveDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("staffLeave")
  const queryClient = useQueryClient()
  const display = useQuery(displaySettingsQuery())
  const today = todayIn(display.data?.locale.timeZone)
  const staff = useQuery(staffDayQuery(today))
  const [employeeId, setEmployeeId] = useState("")
  const [type, setType] = useState<LeaveType>("casual")
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [reason, setReason] = useState("")
  const [approved, setApproved] = useState(true)
  const save = useMutation({
    mutationFn: () =>
      addStaffLeave({
        employeeId,
        fromDate: from,
        toDate: to < from ? from : to,
        leaveType: type,
        reason: reason.trim() || undefined,
        approved,
      }),
    onSuccess: async () => {
      toast.add({ title: t("added"), type: "success" })
      await queryClient.invalidateQueries({ queryKey: staffKeys.all })
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("addTitle")}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="lv-staff">{t("staff")}</Label>
            <NativeSelect
              id="lv-staff"
              className="w-full"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <NativeSelectOption value="">{t("pick")}</NativeSelectOption>
              {(staff.data?.staff ?? []).map((s) => (
                <NativeSelectOption key={s.id} value={s.id}>
                  {s.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lv-type">{t("type")}</Label>
            <NativeSelect
              id="lv-type"
              className="w-full"
              value={type}
              onChange={(e) => setType(e.target.value as LeaveType)}
            >
              {LEAVE_TYPES.map((x) => (
                <NativeSelectOption key={x} value={x}>
                  {t(`types.${x}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lv-from">{t("from")}</Label>
            <Input
              id="lv-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lv-to">{t("to")}</Label>
            <Input
              id="lv-to"
              type="date"
              min={from}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="lv-reason">{t("reason")}</Label>
            <Input
              id="lv-reason"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
            />
            {t("alreadyApproved")}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!employeeId || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
