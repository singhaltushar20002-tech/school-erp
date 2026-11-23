"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  BanIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileBadgeIcon,
  SearchIcon,
} from "lucide-react"
import Link from "next/link"
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
import { Textarea } from "~/components/ui/textarea"
import { toast } from "~/components/ui/toast"
import { Can } from "~/features/access/can"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { studentsQuery, type StudentRow } from "~/features/students/api"
import { useDebouncedValue } from "~/hooks/use-debounced-value"
import { isApiError } from "~/lib/api/errors"
import { cn } from "~/lib/utils"

import {
  CERTIFICATE_TYPES,
  certificateKeys,
  certificatePdf,
  certificatesQuery,
  issueCertificate,
  revokeCertificate,
  type Certificate,
  type CertificateType,
} from "../api"

/**
 * `/dashboard/students/certificates`: issue transfer, character, study
 * and testimonial certificates, download them, and revoke a wrong one.
 * Each PDF carries a QR code that anyone can verify.
 */
export function CertificatesScreen() {
  const t = useTranslations("certificatesScreen")
  const f = useSchoolFormat()
  const [type, setType] = useState<CertificateType | "">("")
  const [status, setStatus] = useState<"" | "valid" | "revoked">("")
  const [page, setPage] = useState(1)
  const list = useQuery(certificatesQuery({ type, status, page }))
  const rows = list.data?.items ?? []
  const pages = Math.max(1, list.data?.meta.totalPages ?? 1)
  const [issuing, setIssuing] = useState(false)
  const [revoking, setRevoking] = useState<Certificate | null>(null)
  const download = useMutation({
    mutationFn: certificatePdf,
    onSuccess: (url) => window.location.assign(url),
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
        <NativeSelect
          aria-label={t("type")}
          value={type}
          onChange={(e) => {
            setType(e.target.value as CertificateType | "")
            setPage(1)
          }}
        >
          <NativeSelectOption value="">{t("allTypes")}</NativeSelectOption>
          {CERTIFICATE_TYPES.map((x) => (
            <NativeSelectOption key={x} value={x}>
              {t(`types.${x}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t("status")}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as typeof status)
            setPage(1)
          }}
        >
          <NativeSelectOption value="">{t("allStatuses")}</NativeSelectOption>
          <NativeSelectOption value="valid">{t("valid")}</NativeSelectOption>
          <NativeSelectOption value="revoked">
            {t("revoked")}
          </NativeSelectOption>
        </NativeSelect>
        <Can permission="certificates:issue">
          <Button className="ms-auto" onClick={() => setIssuing(true)}>
            <FileBadgeIcon data-icon="inline-start" />
            {t("issue")}
          </Button>
        </Can>
      </div>

      {list.isPending ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : rows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("empty")}</EmptyTitle>
            <EmptyDescription>{t("emptyBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("serial")}</TableHead>
                <TableHead>{t("student")}</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t("issuedOn")}
                </TableHead>
                <TableHead>
                  <span className="sr-only">{t("actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow
                  key={c.id}
                  className={cn(c.status === "revoked" && "opacity-60")}
                >
                  <TableCell className="font-mono text-sm">
                    {c.serial}
                    {c.status === "revoked" && (
                      <Badge variant="destructive" className="ms-2">
                        {t("revoked")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/students/${c.studentId}`}
                      className="font-medium hover:underline"
                    >
                      {c.data.studentName}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {c.data.admissionNumber}
                      {c.data.className &&
                        ` · ${c.data.className} ${c.data.sectionName ?? ""}`}
                    </span>
                  </TableCell>
                  <TableCell>{t(`types.${c.type}`)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {f.date(c.issuedAt.slice(0, 10))}
                  </TableCell>
                  <TableCell className="w-0 text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("download", { serial: c.serial })}
                      disabled={download.isPending}
                      onClick={() => download.mutate(c.id)}
                    >
                      <DownloadIcon />
                    </Button>
                    {c.status === "valid" && (
                      <Can permission="certificates:revoke">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("revoke", { serial: c.serial })}
                          onClick={() => setRevoking(c)}
                        >
                          <BanIcon />
                        </Button>
                      </Can>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pages > 1 && (
        <nav
          aria-label={t("pagination")}
          className="flex items-center justify-between gap-2"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeftIcon data-icon="inline-start" />
            {t("previous")}
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {t("pageOf", { page: f.number(page), pages: f.number(pages) })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("next")}
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        </nav>
      )}

      {issuing && (
        <IssueDialog
          onClose={() => setIssuing(false)}
          onIssued={(c) => download.mutate(c.id)}
        />
      )}
      {revoking && (
        <RevokeDialog
          certificate={revoking}
          onClose={() => setRevoking(null)}
        />
      )}
    </div>
  )
}

function IssueDialog({
  onClose,
  onIssued,
}: {
  onClose: () => void
  onIssued: (c: Certificate) => void
}) {
  const t = useTranslations("certificatesScreen")
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const q = useDebouncedValue(search.trim(), 300)
  const found = useQuery({
    ...studentsQuery({ q, page: 1 }),
    enabled: q.length >= 2,
  })
  const [student, setStudent] = useState<StudentRow | null>(null)
  const [type, setType] = useState<CertificateType>("character")
  const [conduct, setConduct] = useState("")
  const [leavingReason, setLeavingReason] = useState("")
  const [remarks, setRemarks] = useState("")
  const issue = useMutation({
    mutationFn: () =>
      issueCertificate(student!.id, {
        type,
        conduct: conduct.trim() || undefined,
        leavingReason:
          type === "tc" ? leavingReason.trim() || undefined : undefined,
        remarks: remarks.trim() || undefined,
      }),
    onSuccess: async (c) => {
      toast.add({
        title: t("issued", { serial: c.serial }),
        description: t("issuedHint"),
        type: "success",
      })
      await queryClient.invalidateQueries({ queryKey: certificateKeys.all })
      onIssued(c)
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
    <Dialog open onOpenChange={(o) => !o && !issue.isPending && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("issueTitle")}</DialogTitle>
          <DialogDescription>{t("issueHint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {student ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
              <span>
                <span className="font-medium">{student.fullName}</span>
                <span className="block text-xs text-muted-foreground">
                  {student.admissionNumber}
                  {student.placement &&
                    ` · ${student.placement.className} ${student.placement.sectionName}`}
                </span>
              </span>
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
              <Label htmlFor="cert-student">{t("student")}</Label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="cert-student"
                  className="ps-9"
                  placeholder={t("findStudent")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {q.length >= 2 && (
                <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border">
                  {(found.data?.items ?? []).map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => setStudent(s)}
                      >
                        <span className="font-medium">{s.fullName}</span>
                        <span className="text-xs text-muted-foreground">
                          {s.admissionNumber}
                          {s.placement &&
                            ` · ${s.placement.className} ${s.placement.sectionName}`}
                        </span>
                      </button>
                    </li>
                  ))}
                  {found.data?.items.length === 0 && (
                    <li className="px-3 py-2 text-sm text-muted-foreground">
                      {t("noMatch")}
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cert-type">{t("type")}</Label>
            <NativeSelect
              id="cert-type"
              className="w-full"
              value={type}
              onChange={(e) => setType(e.target.value as CertificateType)}
            >
              {CERTIFICATE_TYPES.map((x) => (
                <NativeSelectOption key={x} value={x}>
                  {t(`types.${x}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              {t(`typeHints.${type}`)}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cert-conduct">{t("conduct")}</Label>
            <Input
              id="cert-conduct"
              placeholder={t("conductPlaceholder")}
              maxLength={120}
              value={conduct}
              onChange={(e) => setConduct(e.target.value)}
            />
          </div>
          {type === "tc" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cert-leaving">{t("leavingReason")}</Label>
              <Input
                id="cert-leaving"
                maxLength={300}
                value={leavingReason}
                onChange={(e) => setLeavingReason(e.target.value)}
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cert-remarks">{t("remarks")}</Label>
            <Textarea
              id="cert-remarks"
              rows={2}
              maxLength={500}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!student || issue.isPending}
            onClick={() => issue.mutate()}
          >
            {issue.isPending ? t("issuing") : t("issueAndDownload")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RevokeDialog({
  certificate,
  onClose,
}: {
  certificate: Certificate
  onClose: () => void
}) {
  const t = useTranslations("certificatesScreen")
  const queryClient = useQueryClient()
  const [reason, setReason] = useState("")
  const revoke = useMutation({
    mutationFn: () => revokeCertificate(certificate.id, reason.trim()),
    onSuccess: async () => {
      toast.add({ title: t("revokedToast"), type: "success" })
      await queryClient.invalidateQueries({ queryKey: certificateKeys.all })
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
    <Dialog open onOpenChange={(o) => !o && !revoke.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("revokeTitle", { serial: certificate.serial })}
          </DialogTitle>
          <DialogDescription>{t("revokeBody")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cert-reason">{t("reason")}</Label>
          <Textarea
            id="cert-reason"
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || revoke.isPending}
            onClick={() => revoke.mutate()}
          >
            {t("revokeConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
