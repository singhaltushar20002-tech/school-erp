import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { EditStudent } from "~/features/students/components/student-form"

type Props = { params: Promise<{ id: string }> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("students.form")
  return { title: t("editTitle") }
}

/** `/dashboard/students/[id]/edit`: correct a student's details. */
export default async function EditStudentPage({ params }: Props) {
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const t = await getTranslations("students.form")
  return (
    <>
      <PageHeader title={t("editTitle")} />
      <EditStudent id={id} />
    </>
  )
}
