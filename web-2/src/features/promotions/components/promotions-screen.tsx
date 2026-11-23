"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowRightIcon,
  CopyIcon,
  PlayIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
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
import { toast } from "~/components/ui/toast"
import { Can } from "~/features/access/can"
import {
  academicKeys,
  classesQuery,
  sectionsQuery,
} from "~/features/academics/api"
import { useSessions } from "~/features/academics/components/session-picker"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"

import {
  batchesQuery,
  batchQuery,
  commitBatch,
  createBatch,
  deleteBatch,
  OUTCOMES,
  promotionKeys,
  ROLL_BY,
  rollbackBatch,
  rolloverSession,
  updateItem,
  type Outcome,
  type PromotionItem,
  type RollBy,
} from "../api"

/**
 * `/dashboard/students/promotions`: move a class to the next session.
 * A draft lists every student with an outcome and a target section; the
 * office adjusts it, then commits (new enrollments, undoable for 24 h).
 */
export function PromotionsScreen() {
  const t = useTranslations("promotionsScreen")
  const queryClient = useQueryClient()
  const { sessions, isPending } = useSessions()
  const current = sessions.find((s) => s.isCurrent)
  const later = sessions
    .filter((s) => current && (s.startDate ?? "") > (current.startDate ?? ""))
    .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""))
  const [pickedTarget, setTarget] = useState("")
  const target = later.find((s) => s.id === pickedTarget) ?? later[0]
  const classes = useQuery(classesQuery())
  const targetSections = useQuery({
    ...sectionsQuery(target?.id ?? ""),
    enabled: Boolean(target),
  })
  const batches = useQuery(batchesQuery(current?.id ?? ""))
  const [classId, setClassId] = useState("")
  const [rollBy, setRollBy] = useState<RollBy>("merit")
  const [shuffle, setShuffle] = useState(false)
  const [openId, setOpenId] = useState("")
  const ordered = (classes.data ?? [])
    .slice()
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
  const className = (id: string) =>
    classes.data?.find((c) => c.id === id)?.name ?? ""
  const fail = (error: unknown) =>
    toast.add({
      title: t("failed"),
      description: isApiError(error) ? error.message : undefined,
      type: "error",
    })

  const rollover = useMutation({
    mutationFn: () => rolloverSession(target!.id, current!.id),
    onSuccess: async () => {
      toast.add({ title: t("rolloverDone"), type: "success" })
      await queryClient.invalidateQueries({ queryKey: ["academics"] })
    },
    onError: fail,
  })
  const create = useMutation({
    mutationFn: () =>
      createBatch({
        fromYearId: current!.id,
        toYearId: target!.id,
        classId: classId || ordered[0]!.id,
        options: { rollBy, shuffleSections: shuffle },
      }),
    onSuccess: async (batch) => {
      await queryClient.invalidateQueries({ queryKey: promotionKeys.all })
      setOpenId(batch.id)
    },
    onError: fail,
  })

  if (isPending || classes.isPending)
    return <Skeleton className="h-96 rounded-xl" />
  if (!current || !target)
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{t("noNextSession")}</EmptyTitle>
          <EmptyDescription>{t("noNextSessionBody")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  const noSections =
    targetSections.isSuccess && (targetSections.data ?? []).length === 0
  const forTarget = (batches.data ?? [])
    .filter((b) => b.toYearId === target.id)
    .sort(
      (a, b) =>
        (classes.data?.find((c) => c.id === a.classId)?.level ?? 0) -
        (classes.data?.find((c) => c.id === b.classId)?.level ?? 0)
    )

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">{current.name}</Badge>
          <ArrowRightIcon className="size-4 text-muted-foreground" />
          {later.length > 1 ? (
            <NativeSelect
              aria-label={t("toSession")}
              size="sm"
              value={target.id}
              onChange={(e) => setTarget(e.target.value)}
            >
              {later.map((s) => (
                <NativeSelectOption key={s.id} value={s.id}>
                  {s.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          ) : (
            <Badge>{target.name}</Badge>
          )}
        </div>

        {noSections ? (
          <div className="flex flex-col gap-2 rounded-lg bg-muted p-3 text-sm sm:flex-row sm:items-center">
            <p className="flex-1">
              {t("noSectionsYet", { session: target.name })}
            </p>
            <Can permission="academic_years:rollover">
              <Button
                size="sm"
                disabled={rollover.isPending}
                onClick={() => rollover.mutate()}
              >
                <CopyIcon data-icon="inline-start" />
                {rollover.isPending
                  ? t("copying")
                  : t("copyStructure", { session: current.name })}
              </Button>
            </Can>
          </div>
        ) : (
          <Can permission="promotions:create">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pr-class">{t("class")}</Label>
                <NativeSelect
                  id="pr-class"
                  value={classId || ordered[0]?.id}
                  onChange={(e) => setClassId(e.target.value)}
                >
                  {ordered.map((c) => (
                    <NativeSelectOption key={c.id} value={c.id}>
                      {c.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pr-roll">{t("rollBy")}</Label>
                <NativeSelect
                  id="pr-roll"
                  value={rollBy}
                  onChange={(e) => setRollBy(e.target.value as RollBy)}
                >
                  {ROLL_BY.map((r) => (
                    <NativeSelectOption key={r} value={r}>
                      {t(`rollByOptions.${r}`)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <Label className="flex h-10 items-center gap-2 font-normal">
                <Checkbox
                  checked={shuffle}
                  onCheckedChange={(v) => setShuffle(Boolean(v))}
                />
                {t("shuffle")}
              </Label>
              <Button
                disabled={create.isPending}
                onClick={() => create.mutate()}
              >
                {create.isPending ? t("preparing") : t("prepare")}
              </Button>
            </div>
          </Can>
        )}
      </section>

      {forTarget.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t("batches")}</h2>
          <div className="flex flex-wrap gap-2">
            {forTarget.map((b) => (
              <Button
                key={b.id}
                variant={openId === b.id ? "default" : "outline"}
                size="sm"
                onClick={() => setOpenId(b.id)}
              >
                {className(b.classId)}
                <span className="text-xs opacity-70">
                  {t(`statuses.${b.status}`)}
                </span>
              </Button>
            ))}
          </div>
        </section>
      )}

      {openId && (
        <BatchView
          id={openId}
          sections={targetSections.data ?? []}
          onGone={() => setOpenId("")}
        />
      )}
    </div>
  )
}

function BatchView({
  id,
  sections,
  onGone,
}: {
  id: string
  sections: { id: string; classId: string; name: string }[]
  onGone: () => void
}) {
  const t = useTranslations("promotionsScreen")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const batch = useQuery(batchQuery(id))
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: promotionKeys.all })
  const fail = (error: unknown) =>
    toast.add({
      title: t("failed"),
      description: isApiError(error) ? error.message : undefined,
      type: "error",
    })
  const edit = useMutation({
    mutationFn: (v: {
      item: PromotionItem
      body: Parameters<typeof updateItem>[2]
    }) => updateItem(id, v.item.id, v.body),
    onSuccess: refresh,
    onError: fail,
  })
  const commit = useMutation({
    mutationFn: () => commitBatch(id),
    onSuccess: async () => {
      toast.add({ title: t("committed"), type: "success" })
      await refresh()
      await queryClient.invalidateQueries({ queryKey: academicKeys.classes })
    },
    onError: fail,
  })
  const rollback = useMutation({
    mutationFn: () => rollbackBatch(id),
    onSuccess: async () => {
      toast.add({ title: t("rolledBack"), type: "success" })
      await refresh()
    },
    onError: fail,
  })
  const discard = useMutation({
    mutationFn: () => deleteBatch(id),
    onSuccess: async () => {
      toast.add({ title: t("discarded"), type: "success" })
      onGone()
      await refresh()
    },
    onError: fail,
  })

  if (batch.isPending) return <Skeleton className="h-96 rounded-xl" />
  if (!batch.data) return null
  const b = batch.data
  const draft = b.status === "draft"
  const missing = b.items.filter(
    (i) => i.outcome !== "graduate" && !i.toSectionId
  ).length
  const items = b.items
    .slice()
    .sort(
      (x, y) =>
        (x.enrollment?.section?.name ?? "").localeCompare(
          y.enrollment?.section?.name ?? ""
        ) ||
        Number(x.enrollment?.rollNo ?? 0) - Number(y.enrollment?.rollNo ?? 0)
    )

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {OUTCOMES.filter((o) => b.summary[o]).map((o) => (
          <Badge key={o} variant={o === "detain" ? "destructive" : "secondary"}>
            {t(`outcomes.${o}`)}: {f.number(b.summary[o])}
          </Badge>
        ))}
        <span className="ms-auto flex flex-wrap gap-2">
          {draft && (
            <>
              <Can permission="promotions:delete">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={discard.isPending}
                  onClick={() => discard.mutate()}
                >
                  <Trash2Icon data-icon="inline-start" />
                  {t("discard")}
                </Button>
              </Can>
              <Can permission="promotions:commit">
                <Button
                  size="sm"
                  disabled={commit.isPending || missing > 0}
                  onClick={() => commit.mutate()}
                >
                  <PlayIcon data-icon="inline-start" />
                  {commit.isPending
                    ? t("committing")
                    : t("commit", { n: f.number(b.items.length) })}
                </Button>
              </Can>
            </>
          )}
          {b.status === "committed" && (
            <Can permission="promotions:commit">
              <Button
                variant="outline"
                size="sm"
                disabled={rollback.isPending}
                onClick={() => rollback.mutate()}
              >
                <RotateCcwIcon data-icon="inline-start" />
                {t("rollback")}
              </Button>
            </Can>
          )}
        </span>
      </div>
      {draft && missing > 0 && (
        <p className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
          {t("missingSections", { n: f.number(missing) })}
        </p>
      )}
      {b.status === "committed" && b.committedAt && (
        <p className="text-sm text-muted-foreground">
          {t("committedOn", { date: f.date(b.committedAt.slice(0, 10)) })}
        </p>
      )}
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("student")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("now")}</TableHead>
              <TableHead>{t("outcome")}</TableHead>
              <TableHead>{t("toSection")}</TableHead>
              <TableHead className="w-24">{t("newRoll")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((i) => {
              const options = sections
                .filter((s) => s.classId === i.toClassId)
                .sort((x, y) => x.name.localeCompare(y.name))
              return (
                <TableRow key={i.id}>
                  <TableCell>
                    <span className="font-medium">{i.student.fullName}</span>
                    {i.overridden && (
                      <Badge variant="outline" className="ms-2">
                        {t("changed")}
                      </Badge>
                    )}
                    <span className="block font-mono text-xs text-muted-foreground">
                      {i.student.admissionNumber}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {t("sectionRoll", {
                      section: i.enrollment?.section?.name ?? "—",
                      roll: i.enrollment?.rollNo ?? "—",
                    })}
                  </TableCell>
                  <TableCell>
                    <NativeSelect
                      size="sm"
                      aria-label={t("outcomeFor", {
                        name: i.student.fullName,
                      })}
                      value={i.outcome}
                      disabled={!draft || edit.isPending}
                      onChange={(e) =>
                        edit.mutate({
                          item: i,
                          body: { outcome: e.target.value as Outcome },
                        })
                      }
                    >
                      {OUTCOMES.map((o) => (
                        <NativeSelectOption key={o} value={o}>
                          {t(`outcomes.${o}`)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </TableCell>
                  <TableCell>
                    {i.outcome === "graduate" ? (
                      <span className="text-sm text-muted-foreground">
                        {t("leaves")}
                      </span>
                    ) : (
                      <NativeSelect
                        size="sm"
                        className="min-w-32"
                        aria-label={t("sectionFor", {
                          name: i.student.fullName,
                        })}
                        value={i.toSectionId ?? ""}
                        disabled={!draft || edit.isPending}
                        onChange={(e) =>
                          e.target.value &&
                          edit.mutate({
                            item: i,
                            body: { toSectionId: e.target.value },
                          })
                        }
                      >
                        {!i.toSectionId && (
                          <NativeSelectOption value="">—</NativeSelectOption>
                        )}
                        {options.map((s) => (
                          <NativeSelectOption key={s.id} value={s.id}>
                            {i.toClass?.name} {s.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    )}
                  </TableCell>
                  <TableCell>
                    {i.outcome !== "graduate" && (
                      <Input
                        key={i.newRoll ?? ""}
                        aria-label={t("rollFor", { name: i.student.fullName })}
                        className="h-8 w-20"
                        defaultValue={i.newRoll ?? ""}
                        disabled={!draft}
                        maxLength={40}
                        onBlur={(e) => {
                          const v = e.target.value.trim()
                          if (v !== (i.newRoll ?? ""))
                            edit.mutate({
                              item: i,
                              body: { newRoll: v || null },
                            })
                        }}
                      />
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
