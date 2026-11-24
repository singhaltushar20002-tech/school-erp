import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { DesignationsScreen } from "~/features/staff/components/org-structure"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("designations") }
}

/** `/dashboard/staff/designations`: designations and their default roles. */
export default async function Page() {
  const t = await getTranslations("staffSetup.designations")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <DesignationsScreen />
    </>
  )
}
