import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { FeeSetup } from "~/features/fees/components/fee-setup"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("feeSetup") }
}

/** `/dashboard/fees/setup`: What each class pays, and the rules around it. */
export default async function Page() {
  const t = await getTranslations("fees.setup")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <FeeSetup />
    </>
  )
}
