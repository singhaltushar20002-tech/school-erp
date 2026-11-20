import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { StudentDirectory } from "~/features/students/components/student-directory"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("studentDirectory") }
}

/** `/dashboard/students`: the student directory. */
export default async function StudentsPage() {
  const t = await getTranslations("students.directory")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <StudentDirectory />
    </>
  )
}
