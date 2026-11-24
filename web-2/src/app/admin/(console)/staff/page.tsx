import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { StaffScreen } from "~/features/platform/console/staff-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav")
  return { title: t("staff"), robots: { index: false } }
}

export default function Page() {
  return <StaffScreen />
}
