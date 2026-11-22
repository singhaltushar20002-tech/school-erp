import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { EnquiryBoard } from "~/features/enquiries/components/enquiry-board"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("enquiries") }
}

/** `/dashboard/admissions/enquiries`: admission enquiries and follow-ups. */
export default async function Page() {
  const t = await getTranslations("enquiries")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <EnquiryBoard />
    </>
  )
}
