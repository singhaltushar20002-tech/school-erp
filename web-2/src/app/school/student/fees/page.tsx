import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { ChildFees } from "~/features/portal/components/child-fees"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal.nav")
  return { title: t("fees") }
}

/** `/student/fees` in the family portal. */
export default function Page() {
  return (
    <Suspense>
      <ChildFees />
    </Suspense>
  )
}
