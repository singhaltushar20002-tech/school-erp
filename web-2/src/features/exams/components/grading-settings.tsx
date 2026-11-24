"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
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
import { toast } from "~/components/ui/toast"
import { Can } from "~/features/access/can"
import { allows } from "~/features/access/permissions"
import { usePermissions } from "~/features/access/use-permissions"
import { classesQuery, currentSessionQuery } from "~/features/academics/api"
import { WidgetCard } from "~/features/dashboard/components/widget-group"
import { isApiError } from "~/lib/api/errors"

import {
  addGradingFromTemplate,
  classGradingQuery,
  clearClassGrading,
  gradingKeys,
  gradingSystemsQuery,
  gradingTemplatesQuery,
  INDIA_TEMPLATES,
  makeDefaultGrading,
  reportCardFormat,
  setClassGrading,
  type GradingSystem,
} from "../api"

/**
 * `/dashboard/exams/grading`: the school's grading systems and which one
 * each class uses this session. The class's system also decides its
 * report card: CBSE, ICSE or the state board layout.
 */
export function GradingSettings() {
  const t = useTranslations("grading")
  const queryClient = useQueryClient()
  const systems = useQuery(gradingSystemsQuery())
  const templates = useQuery(gradingTemplatesQuery())
  const [code, setCode] = useState("")

  const fail = (error: unknown) =>
    toast.add({
      title: t("failed"),
      description: isApiError(error) ? error.message : undefined,
      type: "error",
    })
  const add = useMutation({
    mutationFn: (c: string) => addGradingFromTemplate(c),
    onSuccess: async (s) => {
      toast.add({ title: t("added", { name: s.name }), type: "success" })
      setCode("")
      await queryClient.invalidateQueries({ queryKey: gradingKeys.all })
    },
    onError: fail,
  })
  const makeDefault = useMutation({
    mutationFn: (id: string) => makeDefaultGrading(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: gradingKeys.all }),
    onError: fail,
  })

  if (systems.isPending) return <Skeleton className="h-96 rounded-xl" />
  const list = systems.data ?? []
  const have = new Set(list.map((s) => s.templateCode))
  const offer = (templates.data ?? []).filter(
    (x) => INDIA_TEMPLATES.includes(x.code) && !have.has(x.code)
  )

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <WidgetCard title={t("systemsTitle")} description={t("systemsHint")}>
        <ul className="flex flex-col divide-y">
          {list.map((s) => (
            <SystemRow
              key={s.id}
              system={s}
              onDefault={() => makeDefault.mutate(s.id)}
              busy={makeDefault.isPending}
            />
          ))}
        </ul>
        {offer.length > 0 && (
          <Can permission="grading_systems:create">
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
              <NativeSelect
                aria-label={t("template")}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              >
                <NativeSelectOption value="">
                  {t("pickTemplate")}
                </NativeSelectOption>
                {offer.map((x) => (
                  <NativeSelectOption key={x.code} value={x.code}>
                    {x.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Button
                variant="outline"
                disabled={!code || add.isPending}
                onClick={() => add.mutate(code)}
              >
                <PlusIcon data-icon="inline-start" />
                {t("add")}
              </Button>
            </div>
          </Can>
        )}
      </WidgetCard>
      <ClassAssignments systems={list} />
    </div>
  )
}

function SystemRow({
  system,
  onDefault,
  busy,
}: {
  system: GradingSystem
  onDefault: () => void
  busy: boolean
}) {
  const t = useTranslations("grading")
  const bands = system.items
    .slice()
    .sort((a, b) => b.minPercent - a.minPercent)
    .map((i) => `${i.letter} ${i.minPercent}–${i.maxPercent}`)
    .join(" · ")
  return (
    <li className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-3">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-2 font-medium">
          {system.name}
          {system.isDefault && <Badge>{t("default")}</Badge>}
          <Badge variant="outline">
            {t(`formats.${reportCardFormat(system.templateCode)}`)}
          </Badge>
        </span>
        <span className="truncate text-xs text-muted-foreground">{bands}</span>
      </span>
      {!system.isDefault && (
        <Can permission="grading_systems:update">
          <Button size="sm" variant="ghost" disabled={busy} onClick={onDefault}>
            {t("makeDefault")}
          </Button>
        </Can>
      )}
    </li>
  )
}

function ClassAssignments({ systems }: { systems: GradingSystem[] }) {
  const t = useTranslations("grading")
  const queryClient = useQueryClient()
  const session = useQuery(currentSessionQuery())
  const yearId = session.data?.id ?? ""
  const classes = useQuery(classesQuery())
  const assigned = useQuery({
    ...classGradingQuery(yearId),
    enabled: Boolean(yearId),
  })
  const canEdit = allows(usePermissions(), {
    permission: "grading_systems:update",
  })
  const fallback = systems.find((s) => s.isDefault)
  const save = useMutation({
    mutationFn: async ({
      classId,
      systemId,
    }: {
      classId: string
      systemId: string
    }) => {
      const current = assigned.data?.find((a) => a.classId === classId)
      if (!systemId) {
        if (current) await clearClassGrading(current.id)
        return
      }
      await setClassGrading({
        academicYearId: yearId,
        classId,
        gradingSystemId: systemId,
      })
    },
    onSuccess: async () => {
      toast.add({ title: t("classSaved"), type: "success" })
      await queryClient.invalidateQueries({ queryKey: gradingKeys.all })
    },
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  if (!classes.data || !assigned.data)
    return <Skeleton className="h-64 rounded-xl" />
  const list = classes.data
    .filter((c) => c.isActive)
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
  return (
    <WidgetCard title={t("classesTitle")} description={t("classesHint")}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("class")}</TableHead>
            <TableHead>{t("system")}</TableHead>
            <TableHead>{t("reportCard")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((c) => {
            const own = assigned.data.find((a) => a.classId === c.id)
            const system =
              systems.find((s) => s.id === own?.gradingSystemId) ?? fallback
            return (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>
                  <NativeSelect
                    aria-label={t("systemFor", { name: c.name })}
                    disabled={!canEdit || save.isPending}
                    value={own?.gradingSystemId ?? ""}
                    onChange={(e) =>
                      save.mutate({ classId: c.id, systemId: e.target.value })
                    }
                  >
                    <NativeSelectOption value="">
                      {t("useDefault", { name: fallback?.name ?? "" })}
                    </NativeSelectOption>
                    {systems.map((s) => (
                      <NativeSelectOption key={s.id} value={s.id}>
                        {s.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {t(`formats.${reportCardFormat(system?.templateCode)}`)}
                  </Badge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </WidgetCard>
  )
}
