"use client"

import { useQuery } from "@tanstack/react-query"
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { InitialsAvatar } from "~/components/common/initials-avatar"
import { Button } from "~/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "~/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { Skeleton } from "~/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import {
  classesQuery,
  currentSessionQuery,
  sectionsQuery,
} from "~/features/academics/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { useDebouncedValue } from "~/hooks/use-debounced-value"

import { placementLabel, studentsQuery, type StudentRow } from "../api"
import { StudentStatusBadge } from "./student-status-badge"

/**
 * `/dashboard/students`: search by name, student ID or a parent's phone,
 * narrow by class and section, open a student's record.
 */
export function StudentDirectory() {
  const t = useTranslations("students.directory")
  const f = useSchoolFormat()
  const [search, setSearch] = useState("")
  const [classId, setClassId] = useState("")
  const [sectionId, setSectionId] = useState("")
  const [page, setPage] = useState(1)
  const q = useDebouncedValue(search.trim(), 300)

  const session = useQuery(currentSessionQuery())
  const classes = useQuery(classesQuery())
  const sections = useQuery({
    ...sectionsQuery(session.data?.id ?? ""),
    enabled: Boolean(session.data?.id),
  })
  const classSections = (sections.data ?? [])
    .filter((s) => s.classId === classId)
    .sort((a, b) => a.name.localeCompare(b.name))

  const list = useQuery(studentsQuery({ q, classId, sectionId, page }))
  const total = list.data?.meta.total ?? 0
  const pages = list.data?.meta.totalPages ?? 1

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <InputGroup className="sm:max-w-sm">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder={t("searchPlaceholder")}
            aria-label={t("search")}
          />
        </InputGroup>
        <div className="flex gap-2">
          <NativeSelect
            aria-label={t("class")}
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value)
              setSectionId("")
              setPage(1)
            }}
          >
            <NativeSelectOption value="">{t("allClasses")}</NativeSelectOption>
            {(classes.data ?? [])
              .slice()
              .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
              .map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name}
                </NativeSelectOption>
              ))}
          </NativeSelect>
          <NativeSelect
            aria-label={t("section")}
            value={sectionId}
            disabled={!classId}
            onChange={(e) => {
              setSectionId(e.target.value)
              setPage(1)
            }}
          >
            <NativeSelectOption value="">{t("allSections")}</NativeSelectOption>
            {classSections.map((s) => (
              <NativeSelectOption key={s.id} value={s.id}>
                {s.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {list.isPending
          ? t("loading")
          : t("count", { count: total, n: f.number(total) })}
      </p>

      {list.isPending ? (
        <ListSkeleton />
      ) : list.isError ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("errorTitle")}</EmptyTitle>
            <EmptyDescription>{t("errorBody")}</EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" onClick={() => list.refetch()}>
            {t("retry")}
          </Button>
        </Empty>
      ) : list.data.items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("emptyBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <StudentTable rows={list.data.items} />
          <StudentList rows={list.data.items} />
        </>
      )}

      {pages > 1 && (
        <nav
          aria-label={t("pagination")}
          className="flex items-center justify-between gap-2"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeftIcon data-icon="inline-start" />
            {t("previous")}
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {t("pageOf", { page: f.number(page), pages: f.number(pages) })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("next")}
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        </nav>
      )}
    </div>
  )
}

const href = (row: StudentRow) => `/dashboard/students/${row.id}`

/** Tablets and up: a table. */
function StudentTable({ rows }: { rows: StudentRow[] }) {
  const t = useTranslations("students")
  return (
    <div className="hidden rounded-xl border md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("directory.name")}</TableHead>
            <TableHead>{t("directory.studentId")}</TableHead>
            <TableHead>{t("directory.classSection")}</TableHead>
            <TableHead className="text-right">{t("directory.roll")}</TableHead>
            <TableHead>{t("directory.status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="relative">
              <TableCell>
                <Link
                  href={href(row)}
                  className="flex items-center gap-3 font-medium after:absolute after:inset-0 hover:underline"
                >
                  <InitialsAvatar name={row.fullName} />
                  {row.fullName}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-xs">
                {row.admissionNumber}
              </TableCell>
              <TableCell>
                {placementLabel(row.placement) ?? (
                  <span className="text-muted-foreground">
                    {t("directory.noClass")}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.placement?.rollNo ?? "—"}
              </TableCell>
              <TableCell>
                <StudentStatusBadge status={row.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** Phones: one tappable row per student. */
function StudentList({ rows }: { rows: StudentRow[] }) {
  const t = useTranslations("students.directory")
  return (
    <ul className="flex flex-col divide-y rounded-xl border md:hidden">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={href(row)}
            className="flex items-center gap-3 px-4 py-3 active:bg-muted"
          >
            <InitialsAvatar name={row.fullName} className="size-10" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{row.fullName}</span>
              <span className="truncate text-sm text-muted-foreground">
                {placementLabel(row.placement) ?? t("noClass")}
                {row.placement?.rollNo &&
                  ` · ${t("rollShort", { roll: row.placement.rollNo })}`}
              </span>
            </span>
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border p-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-24 md:block" />
        </div>
      ))}
    </div>
  )
}
