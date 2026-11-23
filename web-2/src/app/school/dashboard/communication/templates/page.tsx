import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { TemplateEditor } from "~/features/communication/components/template-editor"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("notificationTemplates") }
}

/** `/dashboard/communication/templates`: message wording. */
export default async function Page() {
  const t = await getTranslations("communicationScreens.templates")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <TemplateEditor />
    </>
  )
}
