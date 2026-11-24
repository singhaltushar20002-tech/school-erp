"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PhoneIcon, PlusIcon, SearchIcon, UserPlusIcon } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState } from "react"

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
import { Textarea } from "~/components/ui/textarea"
import { toast } from "~/components/ui/toast"
import { Can } from "~/features/access/can"
import { classesQuery } from "~/features/academics/api"
import { displaySettingsQuery } from "~/features/settings/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"
import { todayIn } from "~/lib/format"
import { cn } from "~/lib/utils"

import {
  addEnquiry,
  enquiriesQuery,
  enquiryKeys,
  SOURCES,
  STAGES,
  updateEnquiry,
  type Enquiry,
  type Source,
  type Stage,
} from "../api"

const OPEN: Stage[] = ["new", "contacted", "visited"]

/**
 * `/dashboard/admissions/enquiries`: the admissions desk's queue, from the
 * first call to admission (or a lost family), with follow-up dates.
 */
export function EnquiryBoard() {
  const t = useTranslations("enquiries")
  const f = useSchoolFormat()
  const display = useQuery(displaySettingsQuery())
  const today = todayIn(display.data?.locale.timeZone)
  const data = useQuery(enquiriesQuery())
  const [stage, setStage] = useState<Stage | "open">("open")
  const [q, setQ] = useState("")
  const [editing, setEditing] = useState<Enquiry | "new" | null>(null)

  if (data.isPending) return <Skeleton className="h-96 rounded-xl" />
  const counts = data.data?.counts ?? ({} as Record<Stage, number>)
  const query = q.trim().toLowerCase()
  const shown = (data.data?.items ?? [])
    .filter((e) =>
      stage === "open" ? OPEN.includes(e.stage) : e.stage === stage
    )
    .filter(
      (e) =>
        !query ||
        e.studentName.toLowerCase().includes(query) ||
        e.guardianName.toLowerCase().includes(query) ||
        e.phone.includes(query)
    )
    .sort((a, b) =>
      stage === "open"
        ? (a.followUpOn ?? "9999").localeCompare(b.followUpOn ?? "9999")
        : b.createdAt.localeCompare(a.createdAt)
    )
  const openCount = OPEN.reduce((n, s) => n + (counts[s] ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label={t("stage")}
          className="flex flex-wrap gap-1.5"
        >
          {(["open", ...STAGES] as const).map((s) => (
            <Button
              key={s}
              role="tab"
              size="sm"
              aria-selected={stage === s}
              variant={stage === s ? "default" : "outline"}
              onClick={() => setStage(s)}
            >
              {t(`stages.${s}`)}{" "}
              <span className="tabular-nums opacity-70">
                {f.number(s === "open" ? openCount : (counts[s] ?? 0))}
              </span>
            </Button>
          ))}
        </div>
        <Can permission="enquiries:manage">
          <Button className="ms-auto" onClick={() => setEditing("new")}>
            <PlusIcon data-icon="inline-start" />
            {t("add")}
          </Button>
        </Can>
      </div>
      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label={t("search")}
          placeholder={t("search")}
          className="ps-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {shown.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("empty")}</EmptyTitle>
            <EmptyDescription>{t("emptyBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {shown.map((e) => {
            const due =
              e.followUpOn && e.followUpOn <= today && OPEN.includes(e.stage)
            return (
              <li
                key={e.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center"
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-col text-left"
                  onClick={() => setEditing(e)}
                >
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {e.studentName}
                    {e.className && (
                      <span className="text-sm font-normal text-muted-foreground">
                        {t("for", { className: e.className })}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <PhoneIcon className="size-3" /> {e.guardianName} ·{" "}
                    {e.phone} · {t(`sources.${e.source}`)}
                  </span>
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  {e.followUpOn && OPEN.includes(e.stage) && (
                    <span
                      className={cn(
                        "text-xs",
                        due
                          ? "font-medium text-destructive"
                          : "text-muted-foreground"
                      )}
                    >
                      {t("followUp", { date: f.date(e.followUpOn) })}
                    </span>
                  )}
                  <Badge
                    variant={
                      e.stage === "admitted"
                        ? "default"
                        : e.stage === "lost"
                          ? "outline"
                          : "secondary"
                    }
                  >
                    {t(`stages.${e.stage}`)}
                  </Badge>
                  {e.stage === "admitted" && e.admittedStudentId ? (
                    <Link
                      href={`/dashboard/students/${e.admittedStudentId}`}
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                      })}
                    >
                      {t("openStudent")}
                    </Link>
                  ) : (
                    OPEN.includes(e.stage) && (
                      <Can permission="students:create">
                        <Link
                          href={`/dashboard/students/new?enquiry=${e.id}`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
                        >
                          <UserPlusIcon data-icon="inline-start" />
                          {t("admit")}
                        </Link>
                      </Can>
                    )
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {editing && (
        <EnquiryDialog
          enquiry={editing === "new" ? null : editing}
          today={today}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function EnquiryDialog({
  enquiry,
  today,
  onClose,
}: {
  enquiry: Enquiry | null
  today: string
  onClose: () => void
}) {
  const t = useTranslations("enquiries")
  const queryClient = useQueryClient()
  const classes = useQuery(classesQuery())
  const [v, setV] = useState({
    studentName: enquiry?.studentName ?? "",
    dateOfBirth: enquiry?.dateOfBirth ?? "",
    gender: enquiry?.gender ?? "",
    classId: enquiry?.classId ?? "",
    guardianName: enquiry?.guardianName ?? "",
    phone: enquiry?.phone ?? "",
    email: enquiry?.email ?? "",
    previousSchool: enquiry?.previousSchool ?? "",
    source: (enquiry?.source ?? "walk_in") as Source,
    notes: enquiry?.notes ?? "",
    followUpOn: enquiry?.followUpOn ?? "",
    stage: (enquiry?.stage ?? "new") as Stage,
    lostReason: enquiry?.lostReason ?? "",
  })
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) =>
    setV((old) => ({ ...old, [k]: value }))
  const save = useMutation({
    mutationFn: () => {
      const body = {
        studentName: v.studentName.trim(),
        dateOfBirth: v.dateOfBirth || null,
        gender: v.gender || null,
        classId: v.classId || null,
        guardianName: v.guardianName.trim(),
        phone: v.phone.trim(),
        email: v.email.trim() || null,
        previousSchool: v.previousSchool.trim() || null,
        source: v.source,
        notes: v.notes.trim() || null,
        followUpOn: v.followUpOn || null,
      }
      return enquiry
        ? updateEnquiry(enquiry.id, {
            ...body,
            stage: v.stage,
            lostReason: v.stage === "lost" ? v.lostReason.trim() || null : null,
          })
        : addEnquiry(body)
    },
    onSuccess: async () => {
      toast.add({ title: enquiry ? t("saved") : t("added"), type: "success" })
      await queryClient.invalidateQueries({ queryKey: enquiryKeys.all })
      onClose()
    },
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  const valid = v.studentName.trim() && v.guardianName.trim() && v.phone.trim()
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {enquiry ? enquiry.studentName : t("addTitle")}
          </DialogTitle>
          <DialogDescription>{t("dialogHint")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="eq-name" label={t("studentName")}>
            <Input
              id="eq-name"
              value={v.studentName}
              maxLength={160}
              onChange={(e) => set("studentName", e.target.value)}
            />
          </Field>
          <Field id="eq-class" label={t("classApplied")}>
            <NativeSelect
              id="eq-class"
              className="w-full"
              value={v.classId}
              onChange={(e) => set("classId", e.target.value)}
            >
              <NativeSelectOption value="">—</NativeSelectOption>
              {(classes.data ?? [])
                .slice()
                .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
                .map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>
                    {c.name}
                  </NativeSelectOption>
                ))}
            </NativeSelect>
          </Field>
          <Field id="eq-dob" label={t("dob")}>
            <Input
              id="eq-dob"
              type="date"
              max={today}
              value={v.dateOfBirth}
              onChange={(e) => set("dateOfBirth", e.target.value)}
            />
          </Field>
          <Field id="eq-gender" label={t("gender")}>
            <NativeSelect
              id="eq-gender"
              className="w-full"
              value={v.gender}
              onChange={(e) => set("gender", e.target.value as typeof v.gender)}
            >
              <NativeSelectOption value="">—</NativeSelectOption>
              {(["male", "female", "other"] as const).map((g) => (
                <NativeSelectOption key={g} value={g}>
                  {t(`genders.${g}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="eq-guardian" label={t("guardianName")}>
            <Input
              id="eq-guardian"
              value={v.guardianName}
              maxLength={160}
              onChange={(e) => set("guardianName", e.target.value)}
            />
          </Field>
          <Field id="eq-phone" label={t("phone")}>
            <Input
              id="eq-phone"
              inputMode="tel"
              value={v.phone}
              maxLength={20}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
          <Field id="eq-email" label={t("email")}>
            <Input
              id="eq-email"
              type="email"
              value={v.email}
              maxLength={160}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
          <Field id="eq-prev" label={t("previousSchool")}>
            <Input
              id="eq-prev"
              value={v.previousSchool}
              maxLength={160}
              onChange={(e) => set("previousSchool", e.target.value)}
            />
          </Field>
          <Field id="eq-source" label={t("source")}>
            <NativeSelect
              id="eq-source"
              className="w-full"
              value={v.source}
              onChange={(e) => set("source", e.target.value as Source)}
            >
              {SOURCES.map((s) => (
                <NativeSelectOption key={s} value={s}>
                  {t(`sources.${s}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="eq-follow" label={t("followUpOn")}>
            <Input
              id="eq-follow"
              type="date"
              value={v.followUpOn}
              onChange={(e) => set("followUpOn", e.target.value)}
            />
          </Field>
          {enquiry && (
            <Field id="eq-stage" label={t("stage")}>
              <NativeSelect
                id="eq-stage"
                className="w-full"
                value={v.stage}
                onChange={(e) => set("stage", e.target.value as Stage)}
              >
                {STAGES.filter(
                  (s) => s !== "admitted" || enquiry.stage === "admitted"
                ).map((s) => (
                  <NativeSelectOption key={s} value={s}>
                    {t(`stages.${s}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
          {v.stage === "lost" && (
            <Field id="eq-lost" label={t("lostReason")}>
              <Input
                id="eq-lost"
                value={v.lostReason}
                maxLength={1000}
                onChange={(e) => set("lostReason", e.target.value)}
              />
            </Field>
          )}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="eq-notes">{t("notes")}</Label>
            <Textarea
              id="eq-notes"
              rows={3}
              value={v.notes}
              maxLength={4000}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Can permission="enquiries:manage">
            <Button
              disabled={!valid || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? t("saving") : t("save")}
            </Button>
          </Can>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
