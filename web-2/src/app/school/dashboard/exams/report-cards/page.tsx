import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { ReportCardEntry } from "~/features/exams/components/report-card-entry"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("reportCards") }
}

/** `/dashboard/exams/report-cards`: remarks, co-scholastic grades and printing report cards. */
export default async function Page() {
  const t = await getTranslations("reportCardEntry")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <ReportCardEntry />
    </>
  )
}
