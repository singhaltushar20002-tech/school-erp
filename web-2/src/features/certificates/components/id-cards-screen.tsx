"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { DownloadIcon, IdCardIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "~/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "~/components/ui/empty"
import { Skeleton } from "~/components/ui/skeleton"
import { toast } from "~/components/ui/toast"
import {
  classesQuery,
  currentSessionQuery,
  sectionsQuery,
} from "~/features/academics/api"
import { isApiError } from "~/lib/api/errors"

import { idCardsPdf } from "../api"

/**
 * `/dashboard/students/id-cards`: one PDF of ID cards per section (photo,
 * student ID, class, blood group, guardian phone and a QR code).
 */
export function IdCardsScreen() {
  const t = useTranslations("idCardsScreen")
  const session = useQuery(currentSessionQuery())
  const classes = useQuery(classesQuery())
  const sections = useQuery({
    ...sectionsQuery(session.data?.id ?? ""),
    enabled: Boolean(session.data?.id),
  })
  const [busy, setBusy] = useState<string | null>(null)
  const print = useMutation({
    mutationFn: (sectionId: string) => {
      setBusy(sectionId)
      return idCardsPdf(sectionId)
    },
    onSuccess: (url) => window.location.assign(url),
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
    onSettled: () => setBusy(null),
  })

  if (session.isPending || classes.isPending || sections.isPending)
    return <Skeleton className="h-96 rounded-xl" />
  const byClass = (classes.data ?? [])
    .slice()
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
    .map((c) => ({
      ...c,
      sections: (sections.data ?? [])
        .filter((s) => s.classId === c.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((c) => c.sections.length > 0)

  if (byClass.length === 0)
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{t("empty")}</EmptyTitle>
          <EmptyDescription>{t("emptyBody")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm">
        <IdCardIcon className="size-4 shrink-0" />
        {t("hint")}
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {byClass.map((c) => (
          <li
            key={c.id}
            className="flex flex-col gap-2 rounded-xl border bg-card p-4"
          >
            <span className="font-semibold">{c.name}</span>
            <div className="flex flex-wrap gap-2">
              {c.sections.map((s) => (
                <Button
                  key={s.id}
                  variant="outline"
                  size="sm"
                  disabled={print.isPending}
                  aria-label={t("downloadFor", {
                    name: `${c.name} ${s.name}`,
                  })}
                  onClick={() => print.mutate(s.id)}
                >
                  <DownloadIcon data-icon="inline-start" />
                  {busy === s.id
                    ? t("preparing")
                    : t("section", { name: s.name })}
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
