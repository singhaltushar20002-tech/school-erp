"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { MegaphoneIcon, PinIcon, PlusIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
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
  EmptyMedia,
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
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"

import {
  noticeKeys,
  noticesQuery,
  postNotice,
  type AudienceType,
  type Notice,
} from "../api"

/** Who a circular can go to from this screen. */
const AUDIENCES = ["all", "guardians", "staff", "class"] as const
type Audience = (typeof AUDIENCES)[number]

/**
 * `/dashboard/notices`: circulars, newest first. Posting one (with
 * `notices:manage`) reaches its audience in the portal and through
 * notifications at once.
 */
export function NoticeBoard() {
  const t = useTranslations("notices")
  const [composing, setComposing] = useState(false)
  const notices = useQuery(noticesQuery())

  return (
    <div className="flex flex-col gap-4">
      <Can permission="notices:manage">
        <div>
          <Button onClick={() => setComposing(true)}>
            <PlusIcon data-icon="inline-start" />
            {t("new")}
          </Button>
        </div>
      </Can>

      {notices.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : !notices.data?.length ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MegaphoneIcon />
            </EmptyMedia>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("emptyBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {notices.data.map((n) => (
            <NoticeItem key={n.id} notice={n} />
          ))}
        </ul>
      )}

      <Compose open={composing} onClose={() => setComposing(false)} />
    </div>
  )
}

function NoticeItem({ notice }: { notice: Notice }) {
  const t = useTranslations("notices")
  const f = useSchoolFormat()
  const classes = useQuery(classesQuery())
  const audience = (type: AudienceType) => {
    if (type === "class") {
      const names = notice.audience.ids
        .map((id) => classes.data?.find((c) => c.id === id)?.name)
        .filter(Boolean)
        .join(", ")
      return names ? t("audience.classNamed", { names }) : t("audience.class")
    }
    return (AUDIENCES as readonly string[]).includes(type)
      ? t(`audience.${type as Audience}`)
      : t("audience.other")
  }
  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        {notice.pinned && (
          <PinIcon className="size-4 text-primary" aria-label={t("pinned")} />
        )}
        <h2 className="flex-1 font-medium">{notice.title}</h2>
        <Badge variant="outline">{audience(notice.audience.type)}</Badge>
      </div>
      <p className="text-sm whitespace-pre-line text-muted-foreground">
        {notice.body}
      </p>
      <p className="text-xs text-muted-foreground">
        {f.dateTime(notice.publishAt)}
      </p>
    </li>
  )
}

function Compose({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("notices")
  const queryClient = useQueryClient()
  const classes = useQuery({ ...classesQuery(), enabled: open })
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [audience, setAudience] = useState<Audience>("all")
  const [classId, setClassId] = useState("")
  const [pinned, setPinned] = useState(false)

  const reset = () => {
    setTitle("")
    setBody("")
    setAudience("all")
    setClassId("")
    setPinned(false)
  }

  const send = useMutation({
    mutationFn: () =>
      postNotice({
        title: title.trim(),
        body: body.trim(),
        audience:
          audience === "class"
            ? { type: "class", ids: [classId] }
            : { type: audience },
        pinned,
      }),
    onSuccess: async () => {
      toast.add({ title: t("sent"), type: "success" })
      reset()
      onClose()
      await queryClient.invalidateQueries({ queryKey: noticeKeys.all })
    },
    onError: (error) =>
      toast.add({
        title: t("sendFailed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })

  const valid =
    title.trim().length >= 3 &&
    body.trim().length >= 3 &&
    (audience !== "class" || Boolean(classId))

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("new")}</DialogTitle>
          <DialogDescription>{t("composeHint")}</DialogDescription>
        </DialogHeader>
        <form
          id="notice-form"
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid && !send.isPending) send.mutate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notice-title">{t("titleLabel")}</Label>
            <Input
              id="notice-title"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notice-body">{t("bodyLabel")}</Label>
            <Textarea
              id="notice-body"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notice-audience">{t("audienceLabel")}</Label>
              <NativeSelect
                id="notice-audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value as Audience)}
              >
                {AUDIENCES.map((a) => (
                  <NativeSelectOption key={a} value={a}>
                    {t(`audience.${a}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            {audience === "class" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notice-class">{t("classLabel")}</Label>
                <NativeSelect
                  id="notice-class"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                >
                  <NativeSelectOption value="" disabled>
                    {t("pickClass")}
                  </NativeSelectOption>
                  {(classes.data ?? [])
                    .slice()
                    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
                    .map((c) => (
                      <NativeSelectOption key={c.id} value={c.id}>
                        {c.name}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
              </div>
            )}
          </div>
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox
              aria-label={t("pin")}
              checked={pinned}
              onCheckedChange={(v) => setPinned(Boolean(v))}
            />
            {t("pin")}
          </Label>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            form="notice-form"
            disabled={!valid || send.isPending}
          >
            {send.isPending ? t("sending") : t("send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
