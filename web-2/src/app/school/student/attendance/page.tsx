import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { ChildAttendance } from "~/features/portal/components/child-attendance"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal.nav")
  return { title: t("attendance") }
}

/** `/student/attendance` in the family portal. */
export default function Page() {
  return (
    <Suspense>
      <ChildAttendance />
    </Suspense>
  )
}
