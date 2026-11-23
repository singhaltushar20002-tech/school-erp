import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { LedgerScreen } from "~/features/finance/components/ledger-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("ledger") }
}

/** `/dashboard/ledger`: cash and bank books. */
export default async function Page() {
  const t = await getTranslations("ledgerScreen")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <LedgerScreen />
    </>
  )
}
