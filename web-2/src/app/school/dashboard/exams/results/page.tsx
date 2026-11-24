import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { ResultsScreen } from "~/features/exams/components/results-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("results") }
}

/** `/dashboard/exams/results`: exam results. */
export default async function Page() {
  const t = await getTranslations("resultsScreen")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <ResultsScreen />
    </>
  )
}
