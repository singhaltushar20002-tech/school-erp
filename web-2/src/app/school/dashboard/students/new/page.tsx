import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { AdmitStudent } from "~/features/students/components/student-form"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("admitStudent") }
}

/** `/dashboard/students/new`: admit a student. */
export default async function AdmitStudentPage() {
  const t = await getTranslations("students.form")
  return (
    <>
      <PageHeader title={t("admitTitle")} description={t("admitDescription")} />
      <AdmitStudent />
    </>
  )
}
