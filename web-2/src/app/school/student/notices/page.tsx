import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PortalNotices } from "~/features/portal/components/portal-notices"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal.nav")
  return { title: t("notices") }
}

/** `/student/notices` in the family portal. */
export default function Page() {
  return (
    <Suspense>
      <PortalNotices />
    </Suspense>
  )
}
