import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageHeader } from "~/components/layouts/page-header"
import { CollectFees } from "~/features/fees/components/collect-fees"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("collectFees") }
}

/** `/dashboard/fees/collect`: Collect fees: find a student and take a payment. */
export default async function Page() {
  const t = await getTranslations("fees.collect")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense>
        <CollectFees />
      </Suspense>
    </>
  )
}
