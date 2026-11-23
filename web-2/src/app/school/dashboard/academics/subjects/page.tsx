import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { SubjectsScreen } from "~/features/academics/components/subjects-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("subjects") }
}

/** `/dashboard/academics/subjects`: subjects and subject groups. */
export default async function Page() {
  const t = await getTranslations("academicSetup.subjects")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <SubjectsScreen />
    </>
  )
}
