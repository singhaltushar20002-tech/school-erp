import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { CommunicationLog } from "~/features/communication/components/communication-log"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("communicationLog") }
}

/** `/dashboard/communication/log`: sent messages. */
export default async function Page() {
  const t = await getTranslations("communicationScreens.log")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <CommunicationLog />
    </>
  )
}
