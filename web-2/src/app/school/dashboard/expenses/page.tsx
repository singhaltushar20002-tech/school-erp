import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { ExpensesScreen } from "~/features/finance/components/expenses-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("expenses") }
}

/** `/dashboard/expenses`: school expenses. */
export default async function Page() {
  const t = await getTranslations("expensesScreen")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <ExpensesScreen />
    </>
  )
}
