"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "~/components/ui/button"
import { useSchoolFormat } from "~/features/settings/use-school-format"

/** Previous / page x of y / next, under a paginated list. */
export function Pager({
  page,
  pages,
  onPage,
}: {
  page: number
  pages: number
  onPage: (page: number) => void
}) {
  const t = useTranslations("setup")
  const f = useSchoolFormat()
  if (pages <= 1) return null
  return (
    <nav
      aria-label={t("pagination")}
      className="flex items-center justify-between gap-2"
    >
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
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
        onClick={() => onPage(page + 1)}
      >
        {t("next")}
        <ChevronRightIcon data-icon="inline-end" />
      </Button>
    </nav>
  )
}
