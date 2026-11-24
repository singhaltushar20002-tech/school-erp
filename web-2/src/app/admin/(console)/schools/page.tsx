import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { SchoolsScreen } from "~/features/platform/console/schools-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav")
  return { title: t("schools"), robots: { index: false } }
}

export default function Page() {
  return <SchoolsScreen />
}
