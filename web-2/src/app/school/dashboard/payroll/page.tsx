import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { PayrollBoard } from "~/features/payroll/components/payroll-board"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("payroll") }
}

/** `/dashboard/payroll`: salaries and monthly payroll. */
export default async function Page() {
  const t = await getTranslations("payroll")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <PayrollBoard />
    </>
  )
}
