import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { MonthlyRegister } from "~/features/attendance/components/monthly-register"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("registers") }
}

/** `/dashboard/attendance/registers`: a section's register for a month. */
export default async function Page() {
  const t = await getTranslations("attendanceRegister")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <MonthlyRegister />
    </>
  )
}
