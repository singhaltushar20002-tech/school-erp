"use client"

import { useTranslations } from "next-intl"

import { Badge } from "~/components/ui/badge"

import type { StudentStatus } from "../api"

/** Active students get a quiet badge; anything else stands out. */
export function StudentStatusBadge({ status }: { status: StudentStatus }) {
  const t = useTranslations("students.status")
  return (
    <Badge variant={status === "active" ? "secondary" : "outline"}>
      {t(status)}
    </Badge>
  )
}
