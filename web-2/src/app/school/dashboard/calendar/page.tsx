import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { SchoolCalendar } from "~/features/calendar/components/school-calendar"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("calendar") }
}

/** `/dashboard/calendar`: the term calendar. */
export default async function Page() {
  const t = await getTranslations("calendar")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <SchoolCalendar />
    </>
  )
}
