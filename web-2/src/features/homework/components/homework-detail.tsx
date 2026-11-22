"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { DownloadIcon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "~/components/ui/button"
import { Skeleton } from "~/components/ui/skeleton"
import { toast } from "~/components/ui/toast"
import { allows } from "~/features/access/permissions"
import { usePermissions } from "~/features/access/use-permissions"
import { WidgetCard } from "~/features/dashboard/components/widget-group"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"

import {
  deleteHomework,
  homeworkKeys,
  homeworkQuery,
  saveSubmissions,
  type HomeworkDetail as Detail,
} from "../api"

/** `/dashboard/homework/[id]`: the homework and who has handed it in. */
export function HomeworkDetail({ id }: { id: string }) {
  const hw = useQuery(homeworkQuery(id))
  if (hw.isPending) return <Skeleton className="h-96 rounded-xl" />
  if (hw.isError) return null
  return <Body key={hw.dataUpdatedAt} hw={hw.data} />
}

function Body({ hw }: { hw: Detail }) {
  const t = useTranslations("homework")
  const f = useSchoolFormat()
  const router = useRouter()
  const queryClient = useQueryClient()
  const canEdit = allows(usePermissions(), { permission: "homework:manage" })
  const [handed, setHanded] = useState(
    () =>
      new Set(hw.roster.filter((r) => r.submitted).map((r) => r.enrollmentId))
  )
  const changed = hw.roster.some(
    (r) => r.submitted !== handed.has(r.enrollmentId)
  )
  const save = useMutation({
    mutationFn: () => saveSubmissions(hw.id, [...handed]),
    onSuccess: async (data) => {
      queryClient.setQueryData(homeworkKeys.detail(hw.id), data)
      await queryClient.invalidateQueries({ queryKey: homeworkKeys.list })
      toast.add({ title: t("saved"), type: "success" })
    },
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  const remove = useMutation({
    mutationFn: () => deleteHomework(hw.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: homeworkKeys.all })
      router.push("/dashboard/homework")
    },
  })
  const missing = hw.roster.filter((r) => !handed.has(r.enrollmentId))
  const toggle = (id: string, on: boolean) =>
    setHanded((s) => {
      const next = new Set(s)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-semibold">{hw.title}</h2>
        <p className="text-sm text-muted-foreground">
          {hw.subjectName} · {hw.className} {hw.sectionName} ·{" "}
          {t("setOnDue", {
            set: f.date(hw.assignedOn),
            due: f.date(hw.dueDate),
          })}
        </p>
      </div>
      {(hw.description || hw.attachmentLinks.length > 0) && (
        <WidgetCard title={t("detailsTitle")}>
          {hw.description && (
            <p className="text-sm whitespace-pre-line">{hw.description}</p>
          )}
          {hw.attachmentLinks.map((a) => (
            <a
              key={a.fileId}
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <DownloadIcon className="size-4" />
              {a.name}
            </a>
          ))}
        </WidgetCard>
      )}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <WidgetCard
          title={t("rosterTitle", {
            done: f.number(handed.size),
            total: f.number(hw.roster.length),
          })}
          description={t("rosterHint")}
        >
          <div className="mb-2 flex gap-2">
            {canEdit && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setHanded(new Set(hw.roster.map((r) => r.enrollmentId)))
                  }
                >
                  {t("allIn")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setHanded(new Set())}
                >
                  {t("noneIn")}
                </Button>
              </>
            )}
          </div>
          <ul className="flex flex-col divide-y">
            {hw.roster.map((r) => (
              <li key={r.enrollmentId}>
                <label className="flex items-center gap-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    disabled={!canEdit}
                    checked={handed.has(r.enrollmentId)}
                    onChange={(e) => toggle(r.enrollmentId, e.target.checked)}
                  />
                  <span className="w-8 text-muted-foreground tabular-nums">
                    {r.rollNo ?? "—"}
                  </span>
                  <span className="font-medium">{r.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </WidgetCard>
        <WidgetCard
          title={t("missingTitle", { n: f.number(missing.length) })}
          description={t("missingHint")}
        >
          {missing.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("allHandedIn")}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {missing.map((r) => (
                <li key={r.enrollmentId}>
                  <span className="text-muted-foreground tabular-nums">
                    {r.rollNo ?? "—"}
                  </span>{" "}
                  {r.name}
                </li>
              ))}
            </ul>
          )}
        </WidgetCard>
      </div>
      {canEdit && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur md:left-(--sidebar-width)">
          <div className="mx-auto flex max-w-5xl items-center gap-2">
            <Button
              variant="ghost"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              <Trash2Icon data-icon="inline-start" />
              {t("delete")}
            </Button>
            <p
              className="flex-1 text-sm text-muted-foreground"
              aria-live="polite"
            >
              {changed ? t("unsaved") : t("allSaved")}
            </p>
            <Button
              disabled={!changed || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? t("saving") : t("save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
