import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { TakeAttendance } from "~/features/attendance/components/take-attendance"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("takeAttendance") }
}

/** `/dashboard/attendance/take`: mark a section's register. */
export default async function TakeAttendancePage() {
  const t = await getTranslations("attendanceTake")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <TakeAttendance />
    </>
  )
}
