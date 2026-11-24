import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { AuditScreen } from "~/features/platform/console/audit-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav")
  return { title: t("audit"), robots: { index: false } }
}

export default function Page() {
  return <AuditScreen />
}
