import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { GuardianDirectory } from "~/features/guardians/components/guardian-directory"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("guardians") }
}

/** `/dashboard/guardians`: parents and guardians. */
export default async function Page() {
  const t = await getTranslations("guardiansScreen")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <GuardianDirectory />
    </>
  )
}
