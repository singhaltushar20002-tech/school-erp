import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { CertificatesScreen } from "~/features/certificates/components/certificates-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("certificates") }
}

/** `/dashboard/students/certificates`: issued certificates. */
export default async function Page() {
  const t = await getTranslations("certificatesScreen")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <CertificatesScreen />
    </>
  )
}
