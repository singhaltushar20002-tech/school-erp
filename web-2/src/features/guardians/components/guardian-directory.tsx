"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  KeyRoundIcon,
  PencilIcon,
  SearchIcon,
} from "lucide-react"
import Link from "next/link"
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
import { Can } from "~/features/access/can"
import { SetupDialog, text } from "~/features/academics/components/setup-table"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { useDebouncedValue } from "~/hooks/use-debounced-value"
import { isApiError } from "~/lib/api/errors"
import { formatPhone } from "~/lib/phone"

import {
  guardianKeys,
  guardiansQuery,
  issuePortalSlip,
  updateGuardian,
  type GuardianRow,
} from "../api"

/**
 * `/dashboard/guardians`: every parent and guardian, their children and
 * whether they can sign in to the parent portal.
 */
export function GuardianDirectory() {
  const t = useTranslations("guardiansScreen")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const q = useDebouncedValue(search.trim(), 300)
  const [portal, setPortal] = useState<"" | "yes" | "no">("")
  const [page, setPage] = useState(1)
  const list = useQuery(guardiansQuery({ q, portal, page }))
  const total = list.data?.meta.total ?? 0
  const pages = Math.max(1, list.data?.meta.totalPages ?? 1)
  const rows = list.data?.items ?? []
  const [editing, setEditing] = useState<GuardianRow | null>(null)
  const [slipFor, setSlipFor] = useState<GuardianRow | null>(null)
  const fail = (error: unknown) =>
    toast.add({
      title: t("failed"),
      description: isApiError(error) ? error.message : undefined,
      type: "error",
    })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
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
          aria-label={t("portal")}
          value={portal}
          onChange={(e) => {
            setPortal(e.target.value as typeof portal)
            setPage(1)
          }}
        >
          <NativeSelectOption value="">{t("portalAll")}</NativeSelectOption>
          <NativeSelectOption value="yes">{t("portalYes")}</NativeSelectOption>
          <NativeSelectOption value="no">{t("portalNo")}</NativeSelectOption>
        </NativeSelect>
        {list.data && (
          <span className="ms-auto text-sm text-muted-foreground">
            {t("count", { count: total, n: f.number(total) })}
          </span>
        )}
      </div>

      {list.isPending ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : rows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("empty")}</EmptyTitle>
            <EmptyDescription>{t("emptyBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("children")}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t("phone")}
                </TableHead>
                <TableHead>{t("portal")}</TableHead>
                <TableHead>
                  <span className="sr-only">{t("actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>
                    <span className="font-medium">{g.name}</span>
                    {g.occupation && (
                      <span className="block text-xs text-muted-foreground">
                        {g.occupation}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ul className="flex flex-col gap-0.5">
                      {g.children.map((c) => (
                        <li key={c.studentId} className="text-sm">
                          <Link
                            href={`/dashboard/students/${c.studentId}`}
                            className="hover:underline"
                          >
                            {c.name}
                          </Link>
                          <span className="text-muted-foreground">
                            {" · "}
                            {c.className
                              ? `${c.className} ${c.sectionName ?? ""}`
                              : t("notEnrolled")}
                            {" · "}
                            {t(`relations.${c.relation}`)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </TableCell>
                  <TableCell className="hidden tabular-nums md:table-cell">
                    {g.phone ? formatPhone(g.phone) : (g.email ?? "—")}
                  </TableCell>
                  <TableCell>
                    {g.userId ? (
                      <Badge variant="secondary">
                        {g.user?.passwordSet ? t("active") : t("notSignedIn")}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {t("none")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="w-0 text-right whitespace-nowrap">
                    <Can permission="guardians:update">
                      {g.userId && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("slipFor", { name: g.name })}
                          title={t("slip")}
                          onClick={() => setSlipFor(g)}
                        >
                          <KeyRoundIcon />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("edit", { name: g.name })}
                        onClick={() => setEditing(g)}
                      >
                        <PencilIcon />
                      </Button>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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

      {editing && (
        <SetupDialog
          title={editing.name}
          description={t("editHint")}
          initial={{
            name: editing.name,
            phone: editing.phone ?? "",
            email: editing.email ?? "",
            occupation: editing.occupation ?? "",
            address: editing.address ?? "",
          }}
          fields={[
            { name: "name", label: t("name"), required: true, maxLength: 160 },
            { name: "phone", label: t("phone"), maxLength: 20 },
            { name: "email", label: t("email"), maxLength: 160 },
            { name: "occupation", label: t("occupation"), maxLength: 120 },
            { name: "address", label: t("address"), wide: true },
          ]}
          onClose={() => setEditing(null)}
          onError={fail}
          onSubmit={async (v) => {
            await updateGuardian(editing.id, {
              name: text(v, "name"),
              phone: text(v, "phone") ?? undefined,
              email: text(v, "email") ?? undefined,
              occupation: text(v, "occupation"),
              address: text(v, "address"),
            })
            toast.add({ title: t("saved"), type: "success" })
            await queryClient.invalidateQueries({ queryKey: guardianKeys.all })
            setEditing(null)
          }}
        />
      )}

      {slipFor && (
        <SlipDialog guardian={slipFor} onClose={() => setSlipFor(null)} />
      )}
    </div>
  )
}

/** Issues a one-time portal password to hand to the parent. */
function SlipDialog({
  guardian,
  onClose,
}: {
  guardian: GuardianRow
  onClose: () => void
}) {
  const t = useTranslations("guardiansScreen")
  const issue = useMutation({
    mutationFn: () => issuePortalSlip(guardian.id),
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  return (
    <Dialog open onOpenChange={(o) => !o && !issue.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("slipTitle", { name: guardian.name })}</DialogTitle>
          <DialogDescription>{t("slipBody")}</DialogDescription>
        </DialogHeader>
        {issue.data && (
          <div className="flex flex-col gap-1 rounded-lg bg-muted p-3 text-sm">
            <span>
              {t("slipLogin", { phone: formatPhone(guardian.phone) })}
            </span>
            <span className="font-mono text-lg font-semibold tracking-wider">
              {issue.data.temporaryPassword}
            </span>
          </div>
        )}
        <DialogFooter>
          {issue.data ? (
            <Button onClick={onClose}>{t("done")}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                {t("cancel")}
              </Button>
              <Button disabled={issue.isPending} onClick={() => issue.mutate()}>
                {t("slipIssue")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
