import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { LibraryDesk } from "~/features/library/components/library-desk"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("library") }
}

/** `/dashboard/library`: the library desk and catalogue. */
export default async function Page() {
  const t = await getTranslations("library")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <LibraryDesk />
    </>
  )
}
