"use client"

import { useQuery } from "@tanstack/react-query"
import {
  AwardIcon,
  BanknoteIcon,
  CalendarCheckIcon,
  PhoneIcon,
  UsersIcon,
} from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"

import { InitialsAvatar } from "~/components/common/initials-avatar"
import { Badge } from "~/components/ui/badge"
import { buttonVariants } from "~/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "~/components/ui/empty"
import { Can } from "~/features/access/can"
import { StatGrid, StatTile } from "~/features/dashboard/components/stat-tile"
import {
  GroupSkeleton,
  WidgetCard,
} from "~/features/dashboard/components/widget-group"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"
import { formatPhone } from "~/lib/phone"
import { cn } from "~/lib/utils"

import {
  feeStatementQuery,
  studentOverviewQuery,
  type FeeStatement,
  type Invoice,
  type StudentOverview,
} from "../api"
import { StudentStatusBadge } from "./student-status-badge"

/**
 * `/dashboard/students/[id]`: one student's record, the same one
 * admissions, attendance, exams and fees write to.
 */
export function StudentProfile({ id }: { id: string }) {
  const t = useTranslations("students.profile")
  const overview = useQuery(studentOverviewQuery(id))

  if (overview.isPending) return <GroupSkeleton tiles={3} cards={2} />
  if (overview.isError) {
    const missing = isApiError(overview.error) && overview.error.status === 404
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{missing ? t("notFound") : t("errorTitle")}</EmptyTitle>
          <EmptyDescription>
            {missing ? t("notFoundBody") : t("errorBody")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return <Profile data={overview.data} />
}

function Profile({ data }: { data: StudentOverview }) {
  const t = useTranslations("students.profile")
  const f = useSchoolFormat()
  const statement = useQuery({
    ...feeStatementQuery(data.profile.id),
    retry: false,
  })
  const { profile, currentEnrollment: enrollment, attendance } = data
  const latest = data.results?.[0] ?? null

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:p-6">
        <InitialsAvatar name={profile.fullName} className="size-16 text-lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold">
              {profile.fullName}
            </h1>
            <StudentStatusBadge status={profile.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {enrollment
              ? t("placement", {
                  className: enrollment.schoolClass.name,
                  section: enrollment.section.name,
                  roll: enrollment.rollNo ?? "—",
                  session: enrollment.academicYear.name,
                })
              : t("noClass")}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            {t("studentId", { id: profile.admissionNumber })}
          </p>
        </div>
        <Can permission="fees:collect">
          <Link
            href={`/dashboard/fees/collect?student=${profile.id}`}
            className={buttonVariants()}
          >
            <BanknoteIcon data-icon="inline-start" />
            {t("collectFee")}
          </Link>
        </Can>
      </header>

      <StatGrid>
        <StatTile
          icon={<CalendarCheckIcon />}
          label={t("attendanceTile")}
          value={
            attendance?.percentage != null
              ? f.percent(attendance.percentage)
              : "—"
          }
          hint={
            attendance
              ? t("attendanceHint", {
                  present: f.number(attendance.present + attendance.late),
                  days: f.number(attendance.days),
                })
              : undefined
          }
        />
        <StatTile
          icon={<BanknoteIcon />}
          label={t("duesTile")}
          value={
            statement.data ? f.moneyShort(statement.data.outstanding) : "—"
          }
          hint={
            statement.data
              ? t("collectedHint", {
                  amount: f.moneyShort(statement.data.collected),
                })
              : undefined
          }
        />
        <StatTile
          icon={<AwardIcon />}
          label={t("resultTile")}
          value={latest?.grade ?? "—"}
          hint={latest ? latest.name : t("noResults")}
        />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <WidgetCard title={t("detailsTitle")}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <Detail
              label={t("dob")}
              value={profile.dob && f.date(profile.dob)}
            />
            <Detail
              label={t("gender")}
              value={profile.gender && t(`genders.${profile.gender}`)}
            />
            <Detail label={t("religion")} value={profile.religion} />
            <Detail label={t("bloodGroup")} value={profile.bloodGroup} />
            <Detail
              label={t("admissionDate")}
              value={profile.admissionDate && f.date(profile.admissionDate)}
            />
            <Detail
              label={t("previousSchool")}
              value={profile.previousSchool}
            />
          </dl>
        </WidgetCard>

        <WidgetCard title={t("guardiansTitle")}>
          {data.guardians.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noGuardians")}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {data.guardians.map((link) => (
                <li
                  key={link.id}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <UsersIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <span className="truncate">{link.guardian.name}</span>
                      {link.isPrimary && (
                        <Badge variant="secondary" className="shrink-0">
                          {t("primary")}
                        </Badge>
                      )}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {isRelation(link.relation)
                        ? t(`relations.${link.relation}`)
                        : link.relation}
                      {link.guardian.occupation &&
                        ` · ${link.guardian.occupation}`}
                      {link.guardian.userId && ` · ${t("hasPortal")}`}
                    </span>
                  </span>
                  {link.guardian.phone && (
                    <a
                      href={`tel:${link.guardian.phone}`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      <PhoneIcon data-icon="inline-start" />
                      <span className="hidden tabular-nums sm:inline">
                        {formatPhone(link.guardian.phone)}
                      </span>
                      <span className="sr-only sm:hidden">
                        {t("call", { name: link.guardian.name })}
                      </span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </WidgetCard>

        {attendance && (
          <WidgetCard
            title={t("attendanceTitle")}
            description={t("attendanceRange", {
              from: f.date(attendance.from),
              to: f.date(attendance.to),
            })}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Count
                label={t("present")}
                value={f.number(attendance.present)}
              />
              <Count label={t("absent")} value={f.number(attendance.absent)} />
              <Count label={t("late")} value={f.number(attendance.late)} />
              <Count label={t("leave")} value={f.number(attendance.leave)} />
            </div>
          </WidgetCard>
        )}

        <WidgetCard title={t("resultsTitle")}>
          {!data.results?.length ? (
            <p className="text-sm text-muted-foreground">{t("noResults")}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {data.results.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {r.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.positionSection != null &&
                        t("position", {
                          section: f.number(r.positionSection),
                          className: f.number(r.positionClass ?? 0),
                        })}
                    </span>
                  </span>
                  {r.grade && <Badge variant="secondary">{r.grade}</Badge>}
                  {r.passed === false && (
                    <Badge variant="destructive">{t("failed")}</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </WidgetCard>
      </div>

      {statement.data && <Fees statement={statement.data} />}
    </div>
  )
}

/** Every bill this session, newest first, with what is still owed. */
function Fees({ statement }: { statement: FeeStatement }) {
  const t = useTranslations("students.profile")
  const f = useSchoolFormat()
  const invoices = statement.invoices
    .filter((i) => i.status !== "cancelled")
    .slice()
    .sort((a, b) => b.period.localeCompare(a.period))
  return (
    <WidgetCard
      title={t("feesTitle")}
      description={[
        t("feesSummary", {
          billed: f.money(statement.billed),
          collected: f.money(statement.collected),
          outstanding: f.money(statement.outstanding),
        }),
        statement.discounts > 0 &&
          t("feesConcession", { amount: f.money(statement.discounts) }),
      ]
        .filter(Boolean)
        .join(" · ")}
    >
      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noInvoices")}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {invoices.map((invoice) => (
            <InvoiceRow key={invoice.id} invoice={invoice} />
          ))}
        </ul>
      )}
    </WidgetCard>
  )
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const t = useTranslations("students.profile")
  const f = useSchoolFormat()
  const owed = invoice.lines.reduce((sum, l) => sum + l.outstanding, 0)
  const heads = invoice.lines.map((l) => l.description).join(", ")
  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">
          {f.month(invoice.period)}
          <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
            {invoice.number}
          </span>
        </span>
        <span className="truncate text-xs text-muted-foreground">{heads}</span>
      </span>
      <span className="flex flex-col items-end gap-0.5">
        <span className="text-sm font-medium tabular-nums">
          {f.money(invoice.netTotal)}
        </span>
        {owed > 0 ? (
          <span className="text-xs text-destructive tabular-nums">
            {t("owed", { amount: f.money(owed) })}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{t("paid")}</span>
        )}
      </span>
    </li>
  )
}

const RELATIONS = ["father", "mother", "guardian", "other"] as const
const isRelation = (r: string): r is (typeof RELATIONS)[number] =>
  (RELATIONS as readonly string[]).includes(r)

function Detail({
  label,
  value,
}: {
  label: string
  value: string | null | undefined | false
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn(!value && "text-muted-foreground")}>{value || "—"}</dd>
    </>
  )
}

function Count({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-muted/50 p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  )
}
