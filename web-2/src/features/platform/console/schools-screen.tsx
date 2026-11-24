"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PlusIcon, SearchIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "~/components/ui/empty"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
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
import { toast } from "~/components/ui/toast"
import { useConsoleCan } from "~/features/platform/shell/components/admin-shell"
import { useDebouncedValue } from "~/hooks/use-debounced-value"
import { isApiError } from "~/lib/api/errors"

import {
  consoleKeys,
  createSchool,
  PLAN_CODES,
  SCHOOL_STATUSES,
  SCHOOL_TYPES,
  schoolsQuery,
  type PlanCode,
  type SchoolStatus,
  type SchoolType,
} from "./api"
import { ConsolePager, useConsoleFormat } from "./format"

export const STATUS_VARIANT: Record<
  SchoolStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  trial: "secondary",
  past_due: "destructive",
  suspended: "destructive",
  inactive: "outline",
  pending: "outline",
}

/** `/schools` on the admin host: every school on the platform. */
export function SchoolsScreen() {
  const t = useTranslations("console.schools")
  const f = useConsoleFormat()
  const can = useConsoleCan()
  const [search, setSearch] = useState("")
  const q = useDebouncedValue(search.trim(), 300)
  const [status, setStatus] = useState<SchoolStatus | "">("")
  const [plan, setPlan] = useState<PlanCode | "">("")
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const list = useQuery(schoolsQuery({ q, status, plan, page }))
  const rows = list.data?.items ?? []

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-2">
        <div className="me-auto">
          <h1 className="font-display text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {can("organizations:manage") && (
          <Button onClick={() => setCreating(true)}>
            <PlusIcon data-icon="inline-start" />
            {t("add")}
          </Button>
        )}
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={t("search")}
            placeholder={t("search")}
            className="ps-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <NativeSelect
          aria-label={t("status")}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as SchoolStatus | "")
            setPage(1)
          }}
        >
          <NativeSelectOption value="">{t("allStatuses")}</NativeSelectOption>
          {SCHOOL_STATUSES.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {t(`statuses.${s}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t("plan")}
          value={plan}
          onChange={(e) => {
            setPlan(e.target.value as PlanCode | "")
            setPage(1)
          }}
        >
          <NativeSelectOption value="">{t("allPlans")}</NativeSelectOption>
          {PLAN_CODES.map((p) => (
            <NativeSelectOption key={p} value={p}>
              {t(`plans.${p}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {list.data && (
          <span className="ms-auto text-sm text-muted-foreground">
            {t("count", {
              count: list.data.meta.total,
              n: f.number(list.data.meta.total),
            })}
          </span>
        )}
      </div>

      {list.isPending ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : rows.length === 0 ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyTitle>{t("empty")}</EmptyTitle>
            <EmptyDescription>{t("emptyBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("school")}</TableHead>
                <TableHead>{t("plan")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-right">{t("students")}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t("joined")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={`/schools/${s.id}`}
                      className="font-medium hover:underline"
                    >
                      {s.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {s.slug}
                      {s.district && ` · ${s.district}`}
                    </span>
                  </TableCell>
                  <TableCell>
                    {s.plan?.name ?? "—"}
                    {s.addOnModules.length > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        {t("addOns", { n: s.addOnModules.length })}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[s.status]}>
                      {t(`statuses.${s.status}`)}
                    </Badge>
                    {s.status === "trial" && s.trialEndsAt && (
                      <span className="block text-xs text-muted-foreground">
                        {t("trialUntil", { date: f.date(s.trialEndsAt) })}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {f.number(s.activeStudentCount)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {f.date(s.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <ConsolePager
        page={page}
        pages={list.data?.meta.totalPages ?? 1}
        onPage={setPage}
      />
      {creating && <CreateSchoolDialog onClose={() => setCreating(false)} />}
    </div>
  )
}

/** A web-address-safe slug from a school name. */
const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)

function CreateSchoolDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("console.schools")
  const router = useRouter()
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [type, setType] = useState<SchoolType>("school")
  const [plan, setPlan] = useState<PlanCode>("standard")
  const [trial, setTrial] = useState("30")
  const [ownerName, setOwnerName] = useState("")
  const [ownerEmail, setOwnerEmail] = useState("")
  const finalSlug = slugTouched ? slug : slugify(name)
  const create = useMutation({
    mutationFn: () =>
      createSchool({
        name: name.trim(),
        slug: finalSlug,
        type,
        planCode: plan,
        trialDays: Number(trial) > 0 ? Number(trial) : undefined,
        ownerName: ownerName.trim() || undefined,
        ownerEmail: ownerEmail.trim() || undefined,
      }),
    onSuccess: async (r) => {
      toast.add({
        title: t("created"),
        description: ownerEmail.trim() ? t("createdHint") : undefined,
        type: "success",
      })
      await queryClient.invalidateQueries({ queryKey: consoleKeys.all })
      router.push(`/schools/${r.id}`)
    },
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  const valid = name.trim() && finalSlug.length >= 3

  return (
    <Dialog open onOpenChange={(o) => !o && !create.isPending && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("addTitle")}</DialogTitle>
          <DialogDescription>{t("addHint")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="cs-name">{t("name")}</Label>
            <Input
              id="cs-name"
              maxLength={160}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="cs-slug">{t("slug")}</Label>
            <Input
              id="cs-slug"
              className="font-mono"
              maxLength={40}
              value={finalSlug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value.toLowerCase())
              }}
            />
            <p className="text-xs text-muted-foreground">
              {t("slugHint", { slug: finalSlug || "…" })}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cs-type">{t("type")}</Label>
            <NativeSelect
              id="cs-type"
              className="w-full"
              value={type}
              onChange={(e) => setType(e.target.value as SchoolType)}
            >
              {SCHOOL_TYPES.map((x) => (
                <NativeSelectOption key={x} value={x}>
                  {t(`types.${x}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cs-plan">{t("plan")}</Label>
            <NativeSelect
              id="cs-plan"
              className="w-full"
              value={plan}
              onChange={(e) => setPlan(e.target.value as PlanCode)}
            >
              {PLAN_CODES.map((x) => (
                <NativeSelectOption key={x} value={x}>
                  {t(`plans.${x}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cs-trial">{t("trialDays")}</Label>
            <Input
              id="cs-trial"
              type="number"
              min={0}
              max={365}
              value={trial}
              onChange={(e) => setTrial(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("trialHint")}</p>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <p className="text-sm font-medium">{t("owner")}</p>
            <p className="text-xs text-muted-foreground">{t("ownerHint")}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cs-oname">{t("ownerName")}</Label>
            <Input
              id="cs-oname"
              maxLength={160}
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cs-oemail">{t("ownerEmail")}</Label>
            <Input
              id="cs-oemail"
              type="email"
              maxLength={254}
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!valid || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? t("creating") : t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
