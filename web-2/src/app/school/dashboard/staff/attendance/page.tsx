import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { StaffRegister } from "~/features/staff-attendance/components/staff-register"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("staffAttendance") }
}

/** `/dashboard/staff/attendance`: the daily staff register. */
export default async function Page() {
  const t = await getTranslations("staffAttendance")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <StaffRegister />
    </>
  )
}
