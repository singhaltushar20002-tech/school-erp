import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import { PageHeader } from "~/components/layouts/page-header"
import { HomeworkDetail } from "~/features/homework/components/homework-detail"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("homework") }
}

/** `/dashboard/homework/[id]`: one homework and who handed it in. */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const t = await getTranslations("homework")
  return (
    <>
      <PageHeader title={t("detailTitle")} />
      <HomeworkDetail id={id} />
    </>
  )
}
