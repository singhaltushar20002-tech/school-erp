"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PaperclipIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useRef, useState } from "react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
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
import { displaySettingsQuery } from "~/features/settings/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"
import { todayIn } from "~/lib/format"
import { cn } from "~/lib/utils"

import {
  homeworkKeys,
  homeworkListQuery,
  homeworkOptionsQuery,
  setHomework,
  uploadHomeworkFile,
} from "../api"

/**
 * `/dashboard/homework`: homework set in the last two weeks and still due,
 * with how many have handed it in; teachers set new homework here.
 */
export function HomeworkList() {
  const t = useTranslations("homework")
  const f = useSchoolFormat()
  const display = useQuery(displaySettingsQuery())
  const today = todayIn(display.data?.locale.timeZone)
  const list = useQuery(homeworkListQuery())
  const [adding, setAdding] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <Can permission="homework:manage">
        <Button className="w-fit" onClick={() => setAdding(true)}>
          <PlusIcon data-icon="inline-start" />
          {t("set")}
        </Button>
      </Can>
      {list.isPending ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !list.data?.length ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("none")}</EmptyTitle>
            <EmptyDescription>{t("noneBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {list.data.map((h) => {
            const pending = (h.students ?? 0) - h.submitted
            const overdue = h.dueDate < today
            return (
              <li key={h.id}>
                <Link
                  href={`/dashboard/homework/${h.id}`}
                  className="flex flex-col gap-1 px-4 py-3 hover:bg-muted sm:flex-row sm:items-center sm:gap-3"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 font-medium">
                      {h.title}
                      {h.attachments > 0 && (
                        <PaperclipIcon
                          className="size-3.5 text-muted-foreground"
                          aria-label={t("hasAttachment")}
                        />
                      )}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {h.subjectName} · {h.className} {h.sectionName}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-sm">
                    <span
                      className={cn(
                        "text-muted-foreground",
                        overdue && "text-foreground"
                      )}
                    >
                      {t("due", { date: f.date(h.dueDate) })}
                    </span>
                    <Badge
                      variant={
                        pending > 0 && overdue ? "destructive" : "secondary"
                      }
                    >
                      {t("handedIn", {
                        done: f.number(h.submitted),
                        total: f.number(h.students ?? 0),
                      })}
                    </Badge>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {adding && (
        <SetHomeworkDialog today={today} onClose={() => setAdding(false)} />
      )}
    </div>
  )
}

function SetHomeworkDialog({
  today,
  onClose,
}: {
  today: string
  onClose: () => void
}) {
  const t = useTranslations("homework")
  const router = useRouter()
  const queryClient = useQueryClient()
  const options = useQuery(homeworkOptionsQuery())
  const [pair, setPair] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState(today)
  const [file, setFile] = useState<File | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = options.data ?? []
  const save = useMutation({
    mutationFn: async () => {
      const [sectionId, classSubjectId] = pair.split(":")
      const attachmentFileIds = file
        ? [(await uploadHomeworkFile(file)).fileId]
        : []
      return setHomework({
        sectionId,
        classSubjectId,
        title: title.trim(),
        description: description.trim() || null,
        dueDate,
        attachmentFileIds,
      })
    },
    onSuccess: async (h) => {
      toast.add({ title: t("setDone"), type: "success" })
      await queryClient.invalidateQueries({ queryKey: homeworkKeys.all })
      router.push(`/dashboard/homework/${h.id}`)
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
          <DialogTitle>{t("setTitle")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hw-pair">{t("classSubject")}</Label>
            <NativeSelect
              id="hw-pair"
              className="w-full"
              value={pair}
              onChange={(e) => setPair(e.target.value)}
            >
              <NativeSelectOption value="">{t("pick")}</NativeSelectOption>
              {list.map((o) => (
                <NativeSelectOption
                  key={`${o.sectionId}:${o.classSubjectId}`}
                  value={`${o.sectionId}:${o.classSubjectId}`}
                >
                  {o.className} {o.sectionName} · {o.subjectName}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hw-title">{t("titleLabel")}</Label>
            <Input
              id="hw-title"
              value={title}
              maxLength={200}
              placeholder={t("titlePlaceholder")}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hw-desc">{t("details")}</Label>
            <Textarea
              id="hw-desc"
              rows={4}
              value={description}
              maxLength={4000}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hw-due">{t("dueDate")}</Label>
              <Input
                id="hw-due"
                type="date"
                min={today}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => input.current?.click()}
              >
                <PaperclipIcon data-icon="inline-start" />
                <span className="truncate">
                  {file ? file.name : t("attach")}
                </span>
              </Button>
              <input
                ref={input}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!pair || !title.trim() || !dueDate || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? t("saving") : t("setButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
