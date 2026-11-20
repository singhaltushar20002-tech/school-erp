import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { ImportWizard } from "~/features/imports/components/import-wizard"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("importStudents") }
}

/** `/dashboard/students/import`: students or staff from Excel. */
export default async function ImportPage() {
  const t = await getTranslations("imports")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <ImportWizard />
    </>
  )
}
