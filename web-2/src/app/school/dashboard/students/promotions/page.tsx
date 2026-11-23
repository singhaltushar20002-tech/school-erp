import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { PromotionsScreen } from "~/features/promotions/components/promotions-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("promotions") }
}

/** `/dashboard/students/promotions`: year-end promotion. */
export default async function Page() {
  const t = await getTranslations("promotionsScreen")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <PromotionsScreen />
    </>
  )
}
