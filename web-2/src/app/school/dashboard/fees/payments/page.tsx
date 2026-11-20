import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageHeader } from "~/components/layouts/page-header"
import { ExportButton } from "~/features/exports/export-button"
import { CollectionLog } from "~/features/fees/components/collection-log"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("payments") }
}

/** `/dashboard/fees/payments`: A day's collection and its receipts. */
export default async function Page() {
  const t = await getTranslations("fees.log")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")}>
        <ExportButton
          path="/reports/exports"
          body={{ report: "fees.receipts" }}
          permission="fees:read"
          range
        />
      </PageHeader>
      <Suspense>
        <CollectionLog />
      </Suspense>
    </>
  )
}
