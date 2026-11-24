"use client"

import { useMutation } from "@tanstack/react-query"
import { ArchiveIcon, DownloadIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "~/components/ui/button"
import { toast } from "~/components/ui/toast"
import { runExport } from "~/features/exports/export-button"
import { isApiError } from "~/lib/api/errors"

/**
 * `/dashboard/settings/export`: every school record as CSV files in one
 * zip, for backup or moving away. School admins only; the link is also
 * emailed to whoever asks.
 */
export function DataExportScreen() {
  const t = useTranslations("dataExportScreen")
  const run = useMutation({
    mutationFn: () => runExport("/settings/export", {}),
    onSuccess: (url) => {
      toast.add({ title: t("ready"), type: "success" })
      window.location.assign(url)
    },
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  return (
    <section className="flex max-w-2xl flex-col gap-4 rounded-xl border bg-card p-6">
      <ArchiveIcon className="size-8 text-muted-foreground" />
      <div className="flex flex-col gap-2 text-sm">
        <p>{t("what")}</p>
        <ul className="list-disc ps-5 text-muted-foreground">
          <li>{t("includes1")}</li>
          <li>{t("includes2")}</li>
          <li>{t("includes3")}</li>
        </ul>
        <p className="text-muted-foreground">{t("privacy")}</p>
      </div>
      <Button
        className="self-start"
        disabled={run.isPending}
        onClick={() => run.mutate()}
      >
        <DownloadIcon data-icon="inline-start" />
        {run.isPending ? t("preparing") : t("start")}
      </Button>
    </section>
  )
}
