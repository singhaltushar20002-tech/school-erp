"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CameraIcon,
  DownloadIcon,
  FileTextIcon,
  PencilIcon,
  UploadIcon,
} from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useRef, useState } from "react"

import { InitialsAvatar } from "~/components/common/initials-avatar"
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
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { toast } from "~/components/ui/toast"
import { Can } from "~/features/access/can"
import { usePermissions } from "~/features/access/use-permissions"
import { allows } from "~/features/access/permissions"
import { WidgetCard } from "~/features/dashboard/components/widget-group"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"

import {
  changeStudentStatus,
  DOCUMENT_TYPES,
  documentDownloadUrl,
  studentDocumentsQuery,
  uploadStudentDocument,
  uploadStudentPhoto,
  type DocumentType,
  type Student,
  type StudentStatus,
} from "../api"

/** Where a status may go next (backend `STATUS_TRANSITIONS`). */
const NEXT: Record<StudentStatus, StudentStatus[]> = {
  active: ["suspended", "transferred", "left", "graduated", "dropped_out"],
  suspended: ["active", "transferred", "left", "dropped_out"],
  transferred: ["active"],
  left: ["active"],
  dropped_out: ["active"],
  graduated: [],
}

const refresh = (queryClient: ReturnType<typeof useQueryClient>, id: string) =>
  queryClient
    .invalidateQueries({ queryKey: ["students"] })
    .then(() => queryClient.invalidateQueries({ queryKey: ["students", id] }))

/** The photo, or the initials; a tap uploads a new one (`students:update`). */
export function StudentPhoto({ student }: { student: Student }) {
  const t = useTranslations("students.record")
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const can = allows(usePermissions(), { permission: "students:update" })
  const upload = useMutation({
    mutationFn: (file: File) => uploadStudentPhoto(student.id, file),
    onSuccess: async () => {
      toast.add({ title: t("photoSaved"), type: "success" })
      await refresh(queryClient, student.id)
    },
    onError: (error) =>
      toast.add({
        title: t("photoFailed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  const picture = student.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
    <img
      src={student.photoUrl}
      alt=""
      className="size-16 rounded-full object-cover"
    />
  ) : (
    <InitialsAvatar name={student.fullName} className="size-16 text-lg" />
  )
  if (!can) return picture
  return (
    <button
      type="button"
      className="group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={t("changePhoto", { name: student.fullName })}
      disabled={upload.isPending}
      onClick={() => input.current?.click()}
    >
      {picture}
      <span className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full border bg-background">
        <CameraIcon className="size-3.5" />
      </span>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) upload.mutate(file)
          e.target.value = ""
        }}
      />
    </button>
  )
}

/** Edit and status change, for staff who may update students. */
export function StudentActions({ student }: { student: Student }) {
  const t = useTranslations("students.record")
  const [open, setOpen] = useState(false)
  const next = NEXT[student.status]
  return (
    <Can permission="students:update">
      <Link
        href={`/dashboard/students/${student.id}/edit`}
        className={buttonVariants({ variant: "outline" })}
      >
        <PencilIcon data-icon="inline-start" />
        {t("edit")}
      </Link>
      {next.length > 0 && (
        <Button variant="outline" onClick={() => setOpen(true)}>
          {t("changeStatus")}
        </Button>
      )}
      {open && (
        <StatusDialog
          student={student}
          options={next}
          onClose={() => setOpen(false)}
        />
      )}
    </Can>
  )
}

function StatusDialog({
  student,
  options,
  onClose,
}: {
  student: Student
  options: StudentStatus[]
  onClose: () => void
}) {
  const t = useTranslations("students")
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<StudentStatus>(options[0])
  const [reason, setReason] = useState("")
  const save = useMutation({
    mutationFn: () =>
      changeStudentStatus(student.id, {
        status,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      }),
    onSuccess: async () => {
      toast.add({
        title: t("record.statusChanged", { status: t(`status.${status}`) }),
        type: "success",
      })
      await refresh(queryClient, student.id)
      onClose()
    },
    onError: (error) =>
      toast.add({
        title: t("record.statusFailed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("record.changeStatus")}</DialogTitle>
          <DialogDescription>
            {t("record.statusHint", { name: student.fullName })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-status">{t("record.newStatus")}</Label>
            <NativeSelect
              id="new-status"
              className="w-full"
              value={status}
              onChange={(e) => setStatus(e.target.value as StudentStatus)}
            >
              {options.map((s) => (
                <NativeSelectOption key={s} value={s}>
                  {t(`status.${s}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status-reason">{t("record.reason")}</Label>
            <Input
              id="status-reason"
              value={reason}
              maxLength={200}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("record.cancel")}
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? t("record.saving") : t("record.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The student's documents (birth certificate, TC…): list, add, open. */
export function StudentDocuments({ studentId }: { studentId: string }) {
  const t = useTranslations("students.record")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const docs = useQuery(studentDocumentsQuery(studentId))
  const input = useRef<HTMLInputElement>(null)
  const [type, setType] = useState<DocumentType>("birth_certificate")
  const upload = useMutation({
    mutationFn: (file: File) =>
      uploadStudentDocument(studentId, file, type, t(`docTypes.${type}`)),
    onSuccess: async () => {
      toast.add({ title: t("docSaved"), type: "success" })
      await queryClient.invalidateQueries({
        queryKey: ["students", studentId, "documents"],
      })
    },
    onError: (error) =>
      toast.add({
        title: t("docFailed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  const open = useMutation({
    mutationFn: (documentId: string) =>
      documentDownloadUrl(studentId, documentId),
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener"),
  })
  if (docs.isError) return null
  return (
    <WidgetCard title={t("documentsTitle")}>
      <div className="flex flex-col gap-3">
        {docs.data?.length ? (
          <ul className="flex flex-col divide-y">
            {docs.data.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2">
                <FileTextIcon className="size-4 text-muted-foreground" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {d.title ?? t(`docTypes.${d.documentType}`)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {f.date(d.createdAt)}
                  </span>
                </span>
                <Badge
                  variant={
                    d.verificationStatus === "verified"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {t(`verification.${d.verificationStatus}`)}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("openDoc", { title: d.title ?? "" })}
                  onClick={() => open.mutate(d.id)}
                >
                  <DownloadIcon />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noDocuments")}</p>
        )}
        <Can permission="student_documents:create">
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <NativeSelect
              aria-label={t("docType")}
              value={type}
              onChange={(e) => setType(e.target.value as DocumentType)}
            >
              {DOCUMENT_TYPES.map((d) => (
                <NativeSelectOption key={d} value={d}>
                  {t(`docTypes.${d}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button
              variant="outline"
              disabled={upload.isPending}
              onClick={() => input.current?.click()}
            >
              <UploadIcon data-icon="inline-start" />
              {upload.isPending ? t("uploading") : t("upload")}
            </Button>
            <input
              ref={input}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) upload.mutate(file)
                e.target.value = ""
              }}
            />
          </div>
        </Can>
      </div>
    </WidgetCard>
  )
}
