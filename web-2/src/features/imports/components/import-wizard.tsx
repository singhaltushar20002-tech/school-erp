"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  CheckCircle2Icon,
  DownloadIcon,
  FileSpreadsheetIcon,
  TriangleAlertIcon,
  UploadIcon,
} from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useRef, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button, buttonVariants } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"
import { cn } from "~/lib/utils"

import {
  commitImport,
  startImport,
  templateUrl,
  waitForImport,
  type ImportBatch,
  type ImportType,
} from "../api"

/**
 * `/dashboard/students/import`: bring in a class list (or the staff list)
 * from Excel. Download the template, fill it, upload it, see every row's
 * problems before anything is saved, then import.
 */
export function ImportWizard() {
  const t = useTranslations("imports")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [type, setType] = useState<ImportType>("students")
  const [batch, setBatch] = useState<ImportBatch | null>(null)
  const [done, setDone] = useState<ImportBatch | null>(null)

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const started = await startImport(type, file)
      return waitForImport(started.import.id, ["uploaded", "validating"])
    },
    onSuccess: (b) => {
      setDone(null)
      setBatch(b)
    },
    onError: (error) =>
      setBatch({
        id: "",
        type,
        status: "failed",
        totals: null,
        errors: [],
        failure: isApiError(error) ? error.message : t("uploadFailed"),
      }),
  })
  const commit = useMutation({
    mutationFn: async (mode: "all_or_nothing" | "valid_only") => {
      await commitImport(batch!.id, mode)
      return waitForImport(batch!.id, ["validated", "committing"])
    },
    onSuccess: async (b) => {
      setDone(b)
      setBatch(null)
      await queryClient.invalidateQueries({ queryKey: ["students"] })
    },
  })
  const totals = batch?.totals
  const busy = upload.isPending || commit.isPending

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div role="tablist" aria-label={t("what")} className="flex gap-1.5">
        {(["students", "staff"] as const).map((k) => (
          <Button
            key={k}
            role="tab"
            aria-selected={type === k}
            variant={type === k ? "default" : "outline"}
            size="sm"
            disabled={busy}
            onClick={() => {
              setType(k)
              setBatch(null)
              setDone(null)
            }}
          >
            {t(`types.${k}`)}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("stepsTitle")}</h2>
          </CardTitle>
          <CardDescription>{t(`hint.${type}`)}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ol className="flex flex-col gap-3 sm:flex-row">
            <Step n={1} label={t("step1")}>
              <a
                href={templateUrl(type)}
                download
                className={buttonVariants({ variant: "outline" })}
              >
                <DownloadIcon data-icon="inline-start" />
                {t("download")}
              </a>
            </Step>
            <Step n={2} label={t("step2")}>
              <span className="text-sm text-muted-foreground">
                {t("step2Hint")}
              </span>
            </Step>
            <Step n={3} label={t("step3")}>
              <Button disabled={busy} onClick={() => input.current?.click()}>
                <UploadIcon data-icon="inline-start" />
                {upload.isPending ? t("checking") : t("upload")}
              </Button>
              <input
                ref={input}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) upload.mutate(file)
                  e.target.value = ""
                }}
              />
            </Step>
          </ol>
        </CardContent>
      </Card>

      {batch?.status === "failed" && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>{t("failedTitle")}</AlertTitle>
          <AlertDescription>
            {batch.failure ?? t("uploadFailed")}
          </AlertDescription>
        </Alert>
      )}

      {batch && totals && batch.status === "validated" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheetIcon className="size-4" />
              <h2>{t("previewTitle")}</h2>
            </CardTitle>
            <CardDescription>
              {t("previewSummary", {
                count: totals.rows,
                rows: f.number(totals.rows),
                valid: f.number(totals.valid),
                invalid: f.number(totals.invalid),
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {batch.errors.length > 0 && (
              <div className="max-h-80 overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">{t("row")}</TableHead>
                      <TableHead>{t("column")}</TableHead>
                      <TableHead>{t("problem")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batch.errors.slice(0, 200).map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="tabular-nums">{e.row}</TableCell>
                        <TableCell>{e.column || "—"}</TableCell>
                        <TableCell className="text-destructive">
                          {e.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {totals.invalid === 0 ? (
                <Button
                  disabled={commit.isPending}
                  onClick={() => commit.mutate("all_or_nothing")}
                >
                  {commit.isPending
                    ? t("importing")
                    : t("importAll", { n: f.number(totals.valid) })}
                </Button>
              ) : (
                totals.valid > 0 && (
                  <Button
                    disabled={commit.isPending}
                    onClick={() => commit.mutate("valid_only")}
                  >
                    {commit.isPending
                      ? t("importing")
                      : t("importValid", {
                          n: f.number(totals.valid),
                          skip: f.number(totals.invalid),
                        })}
                  </Button>
                )
              )}
              <Button
                variant="outline"
                disabled={commit.isPending}
                onClick={() => setBatch(null)}
              >
                {t("startOver")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {done && (
        <Alert className={cn(done.status === "failed" && "border-destructive")}>
          {done.status === "done" ? (
            <CheckCircle2Icon />
          ) : (
            <TriangleAlertIcon />
          )}
          <AlertTitle>
            {done.status === "done" ? t("doneTitle") : t("failedTitle")}
          </AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            {done.status === "done"
              ? t(`doneBody.${type}`, { n: f.number(done.totals?.valid ?? 0) })
              : (done.failure ?? t("uploadFailed"))}
            {done.status === "done" && (
              <Link
                href={
                  type === "students"
                    ? "/dashboard/students"
                    : "/dashboard/staff"
                }
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {t(`open.${type}`)}
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function Step({
  n,
  label,
  children,
}: {
  n: number
  label: string
  children: React.ReactNode
}) {
  return (
    <li className="flex flex-1 flex-col gap-2 rounded-lg border p-3">
      <span className="flex items-center gap-2 text-sm font-medium">
        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs tabular-nums">
          {n}
        </span>
        {label}
      </span>
      {children}
    </li>
  )
}
