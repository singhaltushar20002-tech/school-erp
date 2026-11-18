import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { StudentProfile } from "~/features/students/components/student-profile"

import ComingSoonPage from "../../[...slug]/page"

type Props = { params: Promise<{ id: string }> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const t = await getTranslations("nav.labels")
  return { title: UUID.test(id) ? t("studentDirectory") : undefined }
}

/**
 * `/dashboard/students/[id]`: a student's record. Other paths under
 * `/dashboard/students` (admit, import, …) whose screens aren't built yet
 * open "Coming soon", as they did before this route existed.
 */
export default async function StudentPage({ params }: Props) {
  const { id } = await params
  if (!UUID.test(id)) {
    return (
      <ComingSoonPage params={Promise.resolve({ slug: ["students", id] })} />
    )
  }
  return <StudentProfile id={id} />
}
