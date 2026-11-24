"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { Button } from "~/components/ui/button"

/**
 * Formatting for the console. There's no school here, so it follows the
 * viewer's language (Indian digit grouping) rather than school settings.
 */
export function useConsoleFormat() {
  const locale = useLocale()
  const tag = locale === "hi" ? "hi-IN" : "en-IN"
  return {
    number: (n: number) => new Intl.NumberFormat(tag).format(n),
    /** `minor` in the currency's minor units (paise, poisha). */
    money: (minor: number, currency: string) =>
      new Intl.NumberFormat(tag, {
        style: "currency",
        currency,
        maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
      }).format(minor / 100),
    date: (iso: string) =>
      new Intl.DateTimeFormat(tag, { dateStyle: "medium" }).format(
        new Date(iso)
      ),
    dateTime: (iso: string) =>
      new Intl.DateTimeFormat(tag, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso)),
  }
}

/** Previous / page x of y / next. */
export function ConsolePager({
  page,
  pages,
  onPage,
}: {
  page: number
  pages: number
  onPage: (page: number) => void
}) {
  const t = useTranslations("console.common")
  const f = useConsoleFormat()
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

const ACRONYMS = new Set(["sis", "lms", "sms", "ai", "api", "hr"])

/** `fee_structure.updated` → "Fee structure updated"; `sis` → "SIS". */
export const humanize = (s: string) => {
  const out = s
    .split(/[._]/)
    .map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w))
    .join(" ")
  return out.charAt(0).toUpperCase() + out.slice(1)
}
