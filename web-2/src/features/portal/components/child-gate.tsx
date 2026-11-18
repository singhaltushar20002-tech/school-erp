"use client"

import { CircleAlertIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "~/components/ui/empty"
import { Skeleton } from "~/components/ui/skeleton"

import { childName, type PortalChild } from "../api"
import { useSelectedChild } from "../use-selected-child"

/**
 * A portal page about the selected child (`?child=`): waits for the
 * children, explains when there are none, then renders the page for one.
 */
export function ChildGate({
  title,
  children,
}: {
  /** The page heading; `{name}` is the child's name. */
  title: (name: string) => string
  children: (child: PortalChild) => React.ReactNode
}) {
  const t = useTranslations("portal")
  const locale = useLocale()
  const { children: list, child } = useSelectedChild()

  if (list.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-hidden>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }
  if (list.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <CircleAlertIcon />
        <AlertDescription className="flex flex-col items-start gap-2">
          {t("loadFailed")}
          <Button variant="outline" size="sm" onClick={() => list.refetch()}>
            {t("retry")}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }
  if (!child) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{t("pages.noChildTitle")}</EmptyTitle>
          <EmptyDescription>{t("pages.noChildBody")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {title(childName(child, locale))}
      </h1>
      {children(child)}
    </div>
  )
}

/** A failed load inside a page, with a retry. */
export function PageFailed({ retry }: { retry: () => unknown }) {
  const t = useTranslations("portal")
  return (
    <Alert variant="destructive" role="alert">
      <CircleAlertIcon />
      <AlertDescription className="flex flex-col items-start gap-2">
        {t("loadFailed")}
        <Button variant="outline" size="sm" onClick={() => void retry()}>
          {t("retry")}
        </Button>
      </AlertDescription>
    </Alert>
  )
}
