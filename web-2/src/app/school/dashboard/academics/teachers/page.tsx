import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { TeachersScreen } from "~/features/academics/components/teachers-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("teacherAssignments") }
}

/** `/dashboard/academics/teachers`: class and subject teachers per section. */
export default async function Page() {
  const t = await getTranslations("academicSetup.teachers")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <TeachersScreen />
    </>
  )
}
