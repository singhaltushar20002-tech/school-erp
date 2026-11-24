import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { DomainsScreen } from "~/features/settings/components/domains-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("domains") }
}

/** `/dashboard/settings/domains`: custom web addresses. */
export default async function Page() {
  const t = await getTranslations("domainsScreen")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <DomainsScreen />
    </>
  )
}
