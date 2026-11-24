import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { StaffDirectory } from "~/features/staff/components/staff-directory"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("staffDirectory") }
}

/** `/dashboard/staff`: the staff directory. */
export default async function Page() {
  const t = await getTranslations("staffSetup.directory")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <StaffDirectory />
    </>
  )
}
