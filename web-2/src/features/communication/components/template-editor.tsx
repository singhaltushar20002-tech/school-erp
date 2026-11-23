"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Skeleton } from "~/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { Textarea } from "~/components/ui/textarea"
import { toast } from "~/components/ui/toast"
import { isApiError } from "~/lib/api/errors"
import { cn } from "~/lib/utils"

import {
  communicationKeys,
  EVENTS,
  PLACEHOLDERS,
  resetTemplate,
  saveTemplate,
  templatesQuery,
  type NotificationEvent,
  type Template,
} from "../api"

const LANGUAGES = ["en", "hi"] as const

/**
 * `/dashboard/communication/templates`: the wording of each automatic
 * message (absent alert, fee due, receipt, result, notice) per channel and
 * language. A school's own text replaces the built-in one until reset.
 */
export function TemplateEditor() {
  const t = useTranslations("communicationScreens.templates")
  const te = useTranslations("communicationScreens.events")
  const templates = useQuery(templatesQuery())
  const [event, setEvent] = useState<NotificationEvent>("absent")
  const [channel, setChannel] = useState<Template["channel"]>("inApp")
  const [locale, setLocale] = useState<(typeof LANGUAGES)[number]>("en")

  if (templates.isPending) return <Skeleton className="h-96 rounded-xl" />
  const current = (templates.data ?? []).find(
    (x) => x.key === event && x.channel === channel && x.locale === locale
  )
  const customCount = (k: NotificationEvent) =>
    (templates.data ?? []).filter((x) => x.key === k && x.custom).length

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <nav aria-label={t("events")} className="flex flex-col gap-1">
        {EVENTS.map((k) => (
          <button
            key={k}
            type="button"
            aria-current={event === k}
            onClick={() => setEvent(k)}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
              event === k && "bg-muted font-medium"
            )}
          >
            {te(k)}
            {customCount(k) > 0 && (
              <Badge variant="secondary">{t("edited")}</Badge>
            )}
          </button>
        ))}
      </nav>
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            value={channel}
            onValueChange={(v) => setChannel(v as Template["channel"])}
          >
            <TabsList>
              <TabsTrigger value="inApp">{t("inApp")}</TabsTrigger>
              <TabsTrigger value="email">{t("email")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs
            value={locale}
            onValueChange={(v) => setLocale(v as typeof locale)}
          >
            <TabsList>
              {LANGUAGES.map((l) => (
                <TabsTrigger key={l} value={l}>
                  {t(`languages.${l}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        {current && (
          <TemplateForm
            key={`${event}-${channel}-${locale}-${current.custom}`}
            template={current}
          />
        )}
        <div className="text-sm text-muted-foreground">
          {t("placeholders")}{" "}
          {PLACEHOLDERS[event]
            .map((p) => `{${p}}`)
            .map((token) => (
              <code
                key={token}
                className="me-1 rounded bg-muted px-1 py-0.5 font-mono text-xs"
              >
                {token}
              </code>
            ))}
        </div>
      </section>
    </div>
  )
}

function TemplateForm({ template }: { template: Template }) {
  const t = useTranslations("communicationScreens.templates")
  const queryClient = useQueryClient()
  const [subject, setSubject] = useState(template.subject)
  const [body, setBody] = useState(template.body)
  const done = async (title: string) => {
    toast.add({ title, type: "success" })
    await queryClient.invalidateQueries({
      queryKey: communicationKeys.templates,
    })
  }
  const fail = (error: unknown) =>
    toast.add({
      title: t("failed"),
      description: isApiError(error) ? error.message : undefined,
      type: "error",
    })
  const save = useMutation({
    mutationFn: () =>
      saveTemplate({
        key: template.key,
        channel: template.channel,
        locale: template.locale,
        subject: subject.trim(),
        body: body.trim(),
      }),
    onSuccess: () => done(t("saved")),
    onError: fail,
  })
  const reset = useMutation({
    mutationFn: () => resetTemplate(template.id!),
    onSuccess: () => done(t("resetDone")),
    onError: fail,
  })
  const changed =
    subject.trim() !== template.subject || body.trim() !== template.body

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (changed && subject.trim() && body.trim()) save.mutate()
      }}
    >
      <p className="text-sm text-muted-foreground">
        {template.custom ? t("isCustom") : t("isDefault")}
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tpl-subject">
          {template.channel === "email" ? t("subject") : t("title")}
        </Label>
        <Input
          id="tpl-subject"
          maxLength={200}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tpl-body">{t("body")}</Label>
        <Textarea
          id="tpl-body"
          rows={template.channel === "email" ? 8 : 3}
          maxLength={4000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={
            !changed || !subject.trim() || !body.trim() || save.isPending
          }
        >
          {save.isPending ? t("saving") : t("save")}
        </Button>
        {template.custom && template.id && (
          <Button
            type="button"
            variant="outline"
            disabled={reset.isPending}
            onClick={() => reset.mutate()}
          >
            {t("reset")}
          </Button>
        )}
      </div>
    </form>
  )
}
