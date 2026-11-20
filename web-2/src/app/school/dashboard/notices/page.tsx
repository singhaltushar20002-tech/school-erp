import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { NoticeBoard } from "~/features/notices/components/notice-board"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("notices") }
}

/** `/dashboard/notices`: Circulars to the school, parents, staff or a class. */
export default async function Page() {
  const t = await getTranslations("notices")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <NoticeBoard />
    </>
  )
}
