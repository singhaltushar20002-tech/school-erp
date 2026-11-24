import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { ImportWizard } from "~/features/imports/components/import-wizard"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("openingBalances") }
}

/** `/dashboard/fees/opening-balances`: dues carried over from the old system. */
export default async function Page() {
  const t = await getTranslations("imports.balances")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <ImportWizard only="opening_balances" />
    </>
  )
}
