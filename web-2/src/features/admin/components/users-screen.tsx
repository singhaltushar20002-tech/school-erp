"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { MoreHorizontalIcon, SearchIcon, ShieldIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Pager } from "~/features/shell/components/pager"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
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
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { toast } from "~/components/ui/toast"
import { Can } from "~/features/access/can"
import { usePermissions } from "~/features/access/use-permissions"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { useRoleLabel } from "~/features/admin/components/role-label"
import { isApiError } from "~/lib/api/errors"
import { formatPhone } from "~/lib/phone"

import {
  adminKeys,
  assignRole,
  grantAdmin,
  isPortalRole,
  membersQuery,
  removeMember,
  revokeAdmin,
  rolesQuery,
  setMemberStatus,
  unassignRole,
  type Member,
  type MemberStatus,
} from "../api"

const PAGE = 25
type Kind = "staff" | "parents"

/**
 * `/dashboard/admin/users`: everyone who can sign in to this school, with
 * their roles. Suspend or remove access, change roles, and (school admins
 * only) make someone a school admin.
 */
export function UsersScreen() {
  const t = useTranslations("adminScreens.users")
  const f = useSchoolFormat()
  const label = useRoleLabel()
  const queryClient = useQueryClient()
  const me = usePermissions()
  const members = useQuery(membersQuery())
  const roles = useQuery(rolesQuery())
  const portalRoleIds = new Set(
    (roles.data ?? []).filter(isPortalRole).map((r) => r.id)
  )
  const [kind, setKind] = useState<Kind>("staff")
  const [q, setQ] = useState("")
  const [roleId, setRoleId] = useState("")
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Member | null>(null)
  const [removing, setRemoving] = useState<Member | null>(null)

  const isParent = (m: Member) =>
    m.roles.length > 0 && m.roles.every((r) => portalRoleIds.has(r.id))
  const query = q.trim().toLowerCase()
  const all = (members.data ?? []).filter((m) =>
    kind === "parents" ? isParent(m) : !isParent(m)
  )
  const shown = all.filter(
    (m) =>
      (!roleId || m.roles.some((r) => r.id === roleId)) &&
      (!query ||
        m.name.toLowerCase().includes(query) ||
        (m.email ?? "").toLowerCase().includes(query) ||
        (m.phone ?? "").includes(query))
  )
  const pages = Math.max(1, Math.ceil(shown.length / PAGE))
  const pageRows = shown.slice((page - 1) * PAGE, page * PAGE)
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: adminKeys.members })
  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: async () => {
      toast.add({ title: t("saved"), type: "success" })
      setRemoving(null)
      await refresh()
    },
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  const reset = () => setPage(1)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          value={kind}
          onValueChange={(v) => {
            setKind(v as Kind)
            setRoleId("")
            reset()
          }}
        >
          <TabsList>
            <TabsTrigger value="staff">{t("staff")}</TabsTrigger>
            <TabsTrigger value="parents">{t("parents")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={t("search")}
            placeholder={t("search")}
            className="ps-9"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              reset()
            }}
          />
        </div>
        {kind === "staff" && (
          <NativeSelect
            aria-label={t("role")}
            value={roleId}
            onChange={(e) => {
              setRoleId(e.target.value)
              reset()
            }}
          >
            <NativeSelectOption value="">{t("allRoles")}</NativeSelectOption>
            {(roles.data ?? [])
              .filter((r) => !isPortalRole(r))
              .map((r) => (
                <NativeSelectOption key={r.id} value={r.id}>
                  {label(r)}
                </NativeSelectOption>
              ))}
          </NativeSelect>
        )}
        {members.data && (
          <span className="ms-auto text-sm text-muted-foreground">
            {t("count", { count: shown.length, n: f.number(shown.length) })}
          </span>
        )}
      </div>
      {kind === "staff" && (
        <p className="text-sm text-muted-foreground">{t("addHint")}</p>
      )}

      {members.isPending ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : pageRows.length === 0 ? (
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
                <TableHead className="hidden md:table-cell">
                  {t("signsInWith")}
                </TableHead>
                <TableHead>{t("roles")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>
                  <span className="sr-only">{t("actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {m.name}
                      {m.isAdmin && (
                        <ShieldIcon
                          className="size-4 text-primary"
                          aria-label={t("schoolAdmin")}
                        />
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-sm md:table-cell">
                    {m.email ?? (m.phone ? formatPhone(m.phone) : "—")}
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {m.roles.map((r) => (
                        <Badge key={r.id} variant="outline">
                          {label(r)}
                        </Badge>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        m.status === "active"
                          ? "secondary"
                          : m.status === "suspended"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {t(`statuses.${m.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="w-0 text-right">
                    <Can permission={["users:update", "roles:assign"]}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t("actionsFor", { name: m.name })}
                            />
                          }
                        >
                          <MoreHorizontalIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {kind === "staff" && (
                            <Can permission="roles:assign">
                              <DropdownMenuItem onClick={() => setEditing(m)}>
                                {t("changeRoles")}
                              </DropdownMenuItem>
                            </Can>
                          )}
                          <Can permission="users:update">
                            {m.status === "suspended" ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  act.mutate(() =>
                                    setMemberStatus(m.id, "active")
                                  )
                                }
                              >
                                {t("reactivate")}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() =>
                                  act.mutate(() =>
                                    setMemberStatus(
                                      m.id,
                                      "suspended" as MemberStatus
                                    )
                                  )
                                }
                              >
                                {t("suspend")}
                              </DropdownMenuItem>
                            )}
                          </Can>
                          {me.isAdmin && kind === "staff" && (
                            <DropdownMenuItem
                              onClick={() =>
                                act.mutate(() =>
                                  m.isAdmin
                                    ? revokeAdmin(m.id)
                                    : grantAdmin(m.id)
                                )
                              }
                            >
                              {m.isAdmin ? t("revokeAdmin") : t("makeAdmin")}
                            </DropdownMenuItem>
                          )}
                          <Can permission="users:delete">
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setRemoving(m)}
                            >
                              {t("remove")}
                            </DropdownMenuItem>
                          </Can>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager page={page} pages={pages} onPage={setPage} />

      {editing && (
        <RolesDialog member={editing} onClose={() => setEditing(null)} />
      )}
      <AlertDialog
        open={removing !== null}
        onOpenChange={(o) => !o && !act.isPending && setRemoving(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("removeTitle", { name: removing?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("removeBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={act.isPending}>
              {t("cancel")}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={act.isPending}
              onClick={() =>
                removing && act.mutate(() => removeMember(removing.id))
              }
            >
              {t("removeConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function RolesDialog({
  member,
  onClose,
}: {
  member: Member
  onClose: () => void
}) {
  const t = useTranslations("adminScreens.users")
  const label = useRoleLabel()
  const queryClient = useQueryClient()
  const roles = useQuery(rolesQuery())
  const staffRoles = (roles.data ?? []).filter((r) => !isPortalRole(r))
  const [picked, setPicked] = useState(new Set(member.roles.map((r) => r.id)))
  const save = useMutation({
    mutationFn: async () => {
      const had = new Set(member.roles.map((r) => r.id))
      for (const id of picked) if (!had.has(id)) await assignRole(member.id, id)
      for (const id of had)
        if (!picked.has(id)) await unassignRole(member.id, id)
    },
    onSuccess: async () => {
      toast.add({ title: t("rolesSaved"), type: "success" })
      await queryClient.invalidateQueries({ queryKey: adminKeys.members })
      onClose()
    },
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("rolesTitle", { name: member.name })}</DialogTitle>
          <DialogDescription>{t("rolesHint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {staffRoles.map((r) => (
            <Label key={r.id} className="flex items-start gap-2 font-normal">
              <Checkbox
                checked={picked.has(r.id)}
                onCheckedChange={(on) =>
                  setPicked((old) => {
                    const next = new Set(old)
                    if (on) next.add(r.id)
                    else next.delete(r.id)
                    return next
                  })
                }
              />
              <span className="flex flex-col">
                {label(r)}
                {r.description && (
                  <span className="text-xs text-muted-foreground">
                    {r.description}
                  </span>
                )}
              </span>
            </Label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
