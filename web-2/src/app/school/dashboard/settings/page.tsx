import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { SchoolSettings } from "~/features/settings/components/school-settings"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("schoolSettings") }
}

/** `/dashboard/settings`: school settings. */
export default async function Page() {
  const t = await getTranslations("settingsScreen")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <SchoolSettings />
    </>
  )
}
