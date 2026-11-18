import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { LeaveRequests } from "~/features/leaves/components/leave-requests"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("leaveRequests") }
}

/** `/dashboard/attendance/leaves`: Leave requests from parents. */
export default async function Page() {
  const t = await getTranslations("leaves")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <LeaveRequests />
    </>
  )
}
