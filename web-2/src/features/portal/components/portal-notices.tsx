"use client"

import { useQuery } from "@tanstack/react-query"
import { PinIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Badge } from "~/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "~/components/ui/empty"
import { Skeleton } from "~/components/ui/skeleton"
import { useSchoolFormat } from "~/features/settings/use-school-format"

import { portalNoticesQuery } from "../api"
import { PageFailed } from "./child-gate"

/** `/student/notices`: the school's circulars for this family. */
export function PortalNotices() {
  const t = useTranslations("portal.pages")
  const f = useSchoolFormat()
  const notices = useQuery(portalNoticesQuery())

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {t("noticesTitle")}
      </h1>
      {notices.isPending ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : notices.isError ? (
        <PageFailed retry={notices.refetch} />
      ) : !notices.data.length ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("noNoticesTitle")}</EmptyTitle>
            <EmptyDescription>{t("noNoticesBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {notices.data.map((n) => (
            <li
              key={n.id}
              className="flex flex-col gap-2 rounded-xl border bg-card p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="flex-1 font-medium">{n.title}</h2>
                {n.pinned && (
                  <Badge variant="secondary">
                    <PinIcon aria-hidden />
                    {t("pinned")}
                  </Badge>
                )}
              </div>
              <p className="text-sm whitespace-pre-line text-muted-foreground">
                {n.body}
              </p>
              <p className="text-xs text-muted-foreground">
                {f.date(n.publishAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
