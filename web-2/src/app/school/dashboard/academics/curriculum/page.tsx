import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { CurriculumScreen } from "~/features/academics/components/curriculum-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("curriculum") }
}

/** `/dashboard/academics/curriculum`: the subjects each class studies. */
export default async function Page() {
  const t = await getTranslations("academicSetup.curriculum")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <CurriculumScreen />
    </>
  )
}
