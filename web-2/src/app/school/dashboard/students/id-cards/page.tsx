import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { IdCardsScreen } from "~/features/certificates/components/id-cards-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("idCards") }
}

/** `/dashboard/students/id-cards`: ID cards by section. */
export default async function Page() {
  const t = await getTranslations("idCardsScreen")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <IdCardsScreen />
    </>
  )
}
