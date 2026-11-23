import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { RolesScreen } from "~/features/admin/components/roles-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("roles") }
}

/** `/dashboard/admin/roles`: roles and permissions. */
export default async function Page() {
  const t = await getTranslations("adminScreens.roles")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <RolesScreen />
    </>
  )
}
