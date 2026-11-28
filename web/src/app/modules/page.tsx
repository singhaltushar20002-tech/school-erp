import type { Metadata } from "next";
import { ModulesPage } from "~/features/landing/modules-page";

export const metadata: Metadata = {
  title: "Modules — School ERP",
  description:
    "Every School ERP module: academics, students, attendance, exams, fees, notices, admissions, timetable, HR, LMS, library, transport, hostel and inventory.",
};

export default function Modules() {
  return <ModulesPage />;
}
