import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { ChildResults } from "~/features/portal/components/child-results"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal.nav")
  return { title: t("results") }
}

/** `/student/results` in the family portal. */
export default function Page() {
  return (
    <Suspense>
      <ChildResults />
    </Suspense>
  )
}
