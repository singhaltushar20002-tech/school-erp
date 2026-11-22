import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { TimetableBuilder } from "~/features/timetable/components/timetable-builder"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("timetable") }
}

/** `/dashboard/academics/timetable`: build and publish each section's timetable. */
export default async function Page() {
  const t = await getTranslations("timetable")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <TimetableBuilder />
    </>
  )
}
