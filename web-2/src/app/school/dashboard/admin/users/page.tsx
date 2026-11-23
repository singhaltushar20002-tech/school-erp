import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { UsersScreen } from "~/features/admin/components/users-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("users") }
}

/** `/dashboard/admin/users`: people who can sign in. */
export default async function Page() {
  const t = await getTranslations("adminScreens.users")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <UsersScreen />
    </>
  )
}
