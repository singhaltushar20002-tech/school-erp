"use client"

import { useMutation } from "@tanstack/react-query"
import { DownloadIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { toast } from "~/components/ui/toast"
import { Can } from "~/features/access/can"
import { apiFetch } from "~/lib/api/client"
import { isApiError } from "~/lib/api/errors"

type Job = {
  id: string
  status: string
  downloadUrl?: string | null
  error?: string | null
}

/** Starts an export job, waits for it and returns the file's link. */
export async function runExport(
  path: string,
  body: Record<string, unknown>
): Promise<string> {
  const started = await apiFetch<Job | { job: Job }>(path, {
    method: "POST",
    body,
  })
  let job = "job" in started ? started.job : started
  for (let i = 0; i < 120 && job.status !== "succeeded"; i++) {
    if (job.status === "failed") throw new Error(job.error ?? "failed")
    await new Promise((r) => setTimeout(r, 1000))
    job = await apiFetch<Job>(`/jobs/${job.id}`)
  }
  if (!job.downloadUrl) throw new Error("not ready")
  return job.downloadUrl
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/**
 * "Download Excel" for a page header. With `range`, it first asks for the
 * from/to dates (this month by default) and sends them as `params`.
 */
export function ExportButton({
  path,
  body,
  permission,
  range = false,
}: {
  path: string
  body: Record<string, unknown>
  permission: string
  range?: boolean
}) {
  const t = useTranslations("exports")
  const [asking, setAsking] = useState(false)
  const now = new Date()
  const [from, setFrom] = useState(
    iso(new Date(now.getFullYear(), now.getMonth(), 1))
  )
  const [to, setTo] = useState(iso(now))
  const run = useMutation({
    mutationFn: (extra: Record<string, unknown>) =>
      runExport(path, { ...body, ...extra }),
    onSuccess: (url) => {
      setAsking(false)
      window.location.assign(url)
      toast.add({ title: t("ready"), type: "success" })
    },
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  return (
    <Can permission={permission}>
      <Button
        variant="outline"
        disabled={run.isPending}
        onClick={() => (range ? setAsking(true) : run.mutate({}))}
      >
        <DownloadIcon data-icon="inline-start" />
        {run.isPending && !asking ? t("preparing") : t("download")}
      </Button>
      {asking && (
        <Dialog open onOpenChange={(o) => !o && setAsking(false)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{t("rangeTitle")}</DialogTitle>
              <DialogDescription>{t("rangeHint")}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="export-from">{t("from")}</Label>
                <Input
                  id="export-from"
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="export-to">{t("to")}</Label>
                <Input
                  id="export-to"
                  type="date"
                  value={to}
                  min={from}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAsking(false)}>
                {t("cancel")}
              </Button>
              <Button
                disabled={run.isPending || !from || !to || from > to}
                onClick={() =>
                  run.mutate({
                    params: {
                      ...((body.params as object | undefined) ?? {}),
                      from,
                      to,
                    },
                  })
                }
              >
                {run.isPending ? t("preparing") : t("download")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Can>
  )
}
