"use client"

import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"

import { sessionsApi, setupKeys } from "../api"

/** Sessions, newest first, plus the one to start on (the current one). */
export function useSessions() {
  const sessions = useQuery({
    queryKey: setupKeys.sessions,
    queryFn: ({ signal }) => sessionsApi.list(signal),
  })
  const list = (sessions.data ?? [])
    .slice()
    .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""))
  const fallback = list.find((s) => s.isCurrent)?.id ?? list[0]?.id ?? ""
  const [picked, setPicked] = useState("")
  return {
    sessions: list,
    isPending: sessions.isPending,
    sessionId: picked || fallback,
    setSessionId: setPicked,
  }
}

export function SessionSelect({
  sessions,
  value,
  onChange,
}: {
  sessions: { id: string; name: string; isCurrent: boolean }[]
  value: string
  onChange: (id: string) => void
}) {
  const t = useTranslations("academicSetup")
  return (
    <NativeSelect
      aria-label={t("session")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {sessions.map((s) => (
        <NativeSelectOption key={s.id} value={s.id}>
          {s.isCurrent ? t("currentSuffix", { name: s.name }) : s.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
