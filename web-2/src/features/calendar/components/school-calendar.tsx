"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { Skeleton } from "~/components/ui/skeleton"
import { Textarea } from "~/components/ui/textarea"
import { toast } from "~/components/ui/toast"
import { Can } from "~/features/access/can"
import { allows } from "~/features/access/permissions"
import { usePermissions } from "~/features/access/use-permissions"
import { classesQuery } from "~/features/academics/api"
import { displaySettingsQuery } from "~/features/settings/api"
import { isApiError } from "~/lib/api/errors"
import { todayIn } from "~/lib/format"

import {
  addEvent,
  calendarKeys,
  calendarQuery,
  EVENT_KINDS,
  removeEvent,
  type EventKind,
} from "../api"
import { MonthCalendar } from "./month-calendar"

/**
 * `/dashboard/calendar`: the term at a glance (holidays, exams, PTMs,
 * annual day…), and adding school events.
 */
export function SchoolCalendar() {
  const t = useTranslations("calendar")
  const queryClient = useQueryClient()
  const display = useQuery(displaySettingsQuery())
  const today = todayIn(display.data?.locale.timeZone)
  const [month, setMonth] = useState(today.slice(0, 7))
  const [classId, setClassId] = useState("")
  const [adding, setAdding] = useState(false)
  const classes = useQuery(classesQuery())
  const data = useQuery(calendarQuery(month, classId))
  const canManage = allows(usePermissions(), { permission: "events:manage" })
  const remove = useMutation({
    mutationFn: (id: string) => removeEvent(id),
    onSuccess: async () => {
      toast.add({ title: t("removed"), type: "success" })
      await queryClient.invalidateQueries({ queryKey: calendarKeys.all })
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label={t("class")}
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
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
        <Can permission="events:manage">
          <Button className="ms-auto" onClick={() => setAdding(true)}>
            <PlusIcon data-icon="inline-start" />
            {t("add")}
          </Button>
        </Can>
      </div>
      {data.isPending ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <MonthCalendar
          month={month}
          today={today}
          items={data.data?.items ?? []}
          onMonth={setMonth}
          onRemove={canManage ? (item) => remove.mutate(item.id) : undefined}
        />
      )}
      {adding && (
        <AddEventDialog
          defaultDate={month === today.slice(0, 7) ? today : `${month}-01`}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  )
}

function AddEventDialog({
  defaultDate,
  onClose,
}: {
  defaultDate: string
  onClose: () => void
}) {
  const t = useTranslations("calendar")
  const queryClient = useQueryClient()
  const classes = useQuery(classesQuery())
  const [title, setTitle] = useState("")
  const [kind, setKind] = useState<EventKind>("event")
  const [from, setFrom] = useState(defaultDate)
  const [to, setTo] = useState(defaultDate)
  const [classId, setClassId] = useState("")
  const [description, setDescription] = useState("")
  const [forParents, setForParents] = useState(true)
  const save = useMutation({
    mutationFn: () =>
      addEvent({
        title: title.trim(),
        kind,
        dateFrom: from,
        dateTo: to < from ? from : to,
        description: description.trim() || null,
        classIds: classId ? [classId] : [],
        forParents,
      }),
    onSuccess: async () => {
      toast.add({ title: t("added"), type: "success" })
      await queryClient.invalidateQueries({ queryKey: calendarKeys.all })
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
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ev-title">{t("eventTitle")}</Label>
            <Input
              id="ev-title"
              value={title}
              maxLength={160}
              placeholder={t("titlePlaceholder")}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ev-kind">{t("kind")}</Label>
              <NativeSelect
                id="ev-kind"
                className="w-full"
                value={kind}
                onChange={(e) => setKind(e.target.value as EventKind)}
              >
                {EVENT_KINDS.map((k) => (
                  <NativeSelectOption key={k} value={k}>
                    {t(`kinds.${k}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ev-class">{t("for")}</Label>
              <NativeSelect
                id="ev-class"
                className="w-full"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
              >
                <NativeSelectOption value="">
                  {t("wholeSchool")}
                </NativeSelectOption>
                {(classes.data ?? [])
                  .slice()
                  .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
                  .map((c) => (
                    <NativeSelectOption key={c.id} value={c.id}>
                      {c.name}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ev-from">{t("from")}</Label>
              <Input
                id="ev-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ev-to">{t("to")}</Label>
              <Input
                id="ev-to"
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ev-desc">{t("details")}</Label>
            <Textarea
              id="ev-desc"
              rows={3}
              value={description}
              maxLength={2000}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={forParents}
              onChange={(e) => setForParents(e.target.checked)}
            />
            {t("forParents")}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!title.trim() || !from || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
