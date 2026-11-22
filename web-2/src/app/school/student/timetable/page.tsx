import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { ChildTimetable } from "~/features/portal/components/child-extras"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal.nav")
  return { title: t("timetable") }
}

/** `/student/timetable` in the family portal. */
export default function Page() {
  return (
    <Suspense>
      <ChildTimetable />
    </Suspense>
  )
}
