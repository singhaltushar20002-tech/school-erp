import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { MarkSheetGrid } from "~/features/exams/components/mark-entry"

type Props = { params: Promise<{ sheetId: string }> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("markEntry") }
}

/** `/dashboard/exams/marks/[sheetId]`: one sheet's marks grid. */
export default async function MarkSheetPage({ params }: Props) {
  const { sheetId } = await params
  if (!UUID.test(sheetId)) notFound()
  return <MarkSheetGrid sheetId={sheetId} />
}
