import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { SchoolDetail } from "~/features/platform/console/school-detail"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav")
  return { title: t("schools"), robots: { index: false } }
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <SchoolDetail id={id} />
}
