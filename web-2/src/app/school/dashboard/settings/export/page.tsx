import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { DataExportScreen } from "~/features/settings/components/data-export-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("dataExport") }
}

/** `/dashboard/settings/export`: full data export. */
export default async function Page() {
  const t = await getTranslations("dataExportScreen")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <DataExportScreen />
    </>
  )
}
