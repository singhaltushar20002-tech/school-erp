import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { HomeworkList } from "~/features/homework/components/homework-list"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("homework") }
}

/** `/dashboard/homework`: homework and who has handed it in. */
export default async function Page() {
  const t = await getTranslations("homework")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <HomeworkList />
    </>
  )
}
