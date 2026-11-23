import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { AuditLogScreen } from "~/features/admin/components/audit-log-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("auditLog") }
}

/** `/dashboard/admin/audit-log`: the audit trail. */
export default async function Page() {
  const t = await getTranslations("adminScreens.audit")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <AuditLogScreen />
    </>
  )
}
