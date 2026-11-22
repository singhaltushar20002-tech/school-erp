import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { StaffLeaves } from "~/features/staff-attendance/components/staff-leaves"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("staffLeave") }
}

/** `/dashboard/staff/leave`: staff leave and approvals. */
export default async function Page() {
  const t = await getTranslations("staffLeave")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <StaffLeaves />
    </>
  )
}
