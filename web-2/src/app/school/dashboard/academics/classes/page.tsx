import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { ClassesScreen } from "~/features/academics/components/classes-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("classes") }
}

/** `/dashboard/academics/classes`: classes and their sections. */
export default async function Page() {
  const t = await getTranslations("academicSetup.classes")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <ClassesScreen />
    </>
  )
}
