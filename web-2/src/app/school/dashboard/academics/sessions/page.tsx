import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { SessionsScreen } from "~/features/academics/components/sessions-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("sessions") }
}

/** `/dashboard/academics/sessions`: academic sessions and their terms. */
export default async function Page() {
  const t = await getTranslations("academicSetup.sessions")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <SessionsScreen />
    </>
  )
}
