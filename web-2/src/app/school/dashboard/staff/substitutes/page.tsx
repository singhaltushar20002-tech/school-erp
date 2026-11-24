import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { Substitutes } from "~/features/staff-attendance/components/substitutes"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("substitutes") }
}

/** `/dashboard/staff/substitutes`: substitutes for absent teachers. */
export default async function Page() {
  const t = await getTranslations("substitutes")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Substitutes />
    </>
  )
}
