import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { GradingSettings } from "~/features/exams/components/grading-settings"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("grading") }
}

/** `/dashboard/exams/grading`: the school's grading systems and the report card each class prints. */
export default async function Page() {
  const t = await getTranslations("grading")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <GradingSettings />
    </>
  )
}
