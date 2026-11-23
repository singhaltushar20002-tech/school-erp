import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "~/components/layouts/page-header"
import { ShiftsRoomsScreen } from "~/features/academics/components/shifts-rooms-screen"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.labels")
  return { title: t("shiftsRooms") }
}

/** `/dashboard/academics/shifts-rooms`: shifts and rooms. */
export default async function Page() {
  const t = await getTranslations("academicSetup.shiftsRooms")
  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <ShiftsRoomsScreen />
    </>
  )
}
