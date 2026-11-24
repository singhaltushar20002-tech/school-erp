import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PlansScreen } from "~/features/platform/console/plans-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav")
  return { title: t("plans"), robots: { index: false } }
}

export default function Page() {
  return <PlansScreen />
}
