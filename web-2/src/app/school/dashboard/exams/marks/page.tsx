import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { MarkEntryList } from "~/features/exams/components/mark-entry"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("markEntry") }
}

/** `/dashboard/exams/marks`: mark sheets to fill in. */
export default async function MarkEntryPage() {
  const t = await getTranslations("exams.marks")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <MarkEntryList />
    </>
  )
}
