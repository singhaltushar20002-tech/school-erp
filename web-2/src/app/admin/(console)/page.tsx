import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { BRAND } from "~/config/brand-config"
import { ConsoleOverview } from "~/features/platform/console/overview"
import { getSession } from "~/lib/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin")
  return { title: t("title", { brand: BRAND.name }), robots: { index: false } }
}

/** The console's home: platform totals, plans in use and recent activity. */
export default async function AdminHomePage() {
  const session = await getSession()
  const name = session?.user.name ?? session?.user.email ?? ""
  return <ConsoleOverview name={name} />
}
