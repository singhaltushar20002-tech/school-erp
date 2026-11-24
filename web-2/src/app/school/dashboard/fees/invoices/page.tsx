import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { InvoicesScreen } from "~/features/finance/components/invoices-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("invoices") }
}

/** `/dashboard/fees/invoices`: every invoice. */
export default async function Page() {
  const t = await getTranslations("invoicesScreen")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <InvoicesScreen />
    </>
  )
}
