import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { ConcessionApprovals } from "~/features/fees/components/concession-approvals"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("approvals") }
}

/** `/dashboard/fees/approvals`: Concessions waiting for approval. */
export default async function Page() {
  const t = await getTranslations("fees.approvals")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <ConcessionApprovals />
    </>
  )
}
