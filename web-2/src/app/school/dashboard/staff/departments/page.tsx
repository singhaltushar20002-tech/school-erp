import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { DepartmentsScreen } from "~/features/staff/components/org-structure"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("departments") }
}

/** `/dashboard/staff/departments`: departments. */
export default async function Page() {
  const t = await getTranslations("staffSetup.departments")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <DepartmentsScreen />
    </>
  )
}
