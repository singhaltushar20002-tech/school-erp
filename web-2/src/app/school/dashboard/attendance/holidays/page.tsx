import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { HolidaysScreen } from "~/features/academics/components/holidays-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("holidays") }
}

/** `/dashboard/attendance/holidays`: the holiday list. */
export default async function Page() {
  const t = await getTranslations("academicSetup.holidays")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <HolidaysScreen />
    </>
  )
}
