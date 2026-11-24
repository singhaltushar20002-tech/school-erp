import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { ExamOverview } from "~/features/exams/components/exam-overview"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("examList") }
}

/** `/dashboard/exams`: the exam in-charge's view. */
export default async function ExamsPage() {
  const t = await getTranslations("exams.overview")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <ExamOverview />
    </>
  )
}
