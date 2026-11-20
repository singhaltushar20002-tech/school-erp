import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageHeader } from "~/components/layouts/page-header"
import { DuesReport } from "~/features/fees/components/dues-report"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("dues") }
}

/** `/dashboard/fees/dues`: Students with overdue fees, by how long they are overdue. */
export default async function Page() {
  const t = await getTranslations("fees.dues")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense>
        <DuesReport />
      </Suspense>
    </>
  )
}
