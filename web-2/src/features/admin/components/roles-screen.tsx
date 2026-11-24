"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CopyIcon, LockIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

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
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Skeleton } from "~/components/ui/skeleton"
import { toast } from "~/components/ui/toast"
import { Can } from "~/features/access/can"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"
import { cn } from "~/lib/utils"

import {
  adminKeys,
  cloneRole,
  deleteRole,
  isPortalRole,
  membersQuery,
  permissionsQuery,
  rolesQuery,
  setRolePermissions,
  type RoleRow,
} from "../api"
import { useRoleLabel } from "./role-label"

/** Turns `student_leaves` into "Student leaves". */
const humanize = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ")

/**
 * `/dashboard/admin/roles`: what each role can do. Pick a role to see its
 * permissions by area; built-in roles can be copied into a custom one.
 */
export function RolesScreen() {
  const t = useTranslations("adminScreens.roles")
  const f = useSchoolFormat()
  const label = useRoleLabel()
  const roles = useQuery(rolesQuery())
  const members = useQuery(membersQuery())
  const staffRoles = (roles.data ?? [])
    .filter((r) => !isPortalRole(r))
    .sort(
      (a, b) =>
        Number(b.isSystem) - Number(a.isSystem) ||
        label(a).localeCompare(label(b))
    )
  const [pickedId, setPickedId] = useState("")
  const role = staffRoles.find((r) => r.id === pickedId) ?? staffRoles[0]
  const [cloning, setCloning] = useState<RoleRow | null>(null)
  const holders = (id: string) =>
    (members.data ?? []).filter((m) => m.roles.some((r) => r.id === id)).length

  if (roles.isPending) return <Skeleton className="h-96 rounded-xl" />

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[18rem_1fr]">
      <div className="flex flex-col gap-2">
        <ul className="flex flex-col gap-1">
          {staffRoles.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                aria-current={role?.id === r.id}
                onClick={() => setPickedId(r.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                  role?.id === r.id && "bg-muted font-medium"
                )}
              >
                <span className="flex items-center gap-1.5">
                  {label(r)}
                  {!r.isSystem && (
                    <Badge variant="outline">{t("custom")}</Badge>
                  )}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("people", {
                    count: holders(r.id),
                    n: f.number(holders(r.id)),
                  })}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {role && (
          <Can permission="roles:manage">
            <Button variant="outline" onClick={() => setCloning(role)}>
              <PlusIcon data-icon="inline-start" />
              {t("newFrom", { name: label(role) })}
            </Button>
          </Can>
        )}
      </div>
      {role && (
        <RoleDetail
          key={`${role.id}-${role.permissions.length}`}
          role={role}
          onClone={() => setCloning(role)}
          onDeleted={() => setPickedId("")}
        />
      )}
      {cloning && (
        <CloneDialog
          role={cloning}
          onClose={() => setCloning(null)}
          onCreated={(id) => setPickedId(id)}
        />
      )}
    </div>
  )
}

function RoleDetail({
  role,
  onClone,
  onDeleted,
}: {
  role: RoleRow
  onClone: () => void
  onDeleted: () => void
}) {
  const t = useTranslations("adminScreens.roles")
  const label = useRoleLabel()
  const queryClient = useQueryClient()
  const groups = useQuery(permissionsQuery())
  const [keys, setKeys] = useState(new Set(role.permissions))
  // The admin role always has everything; portal keys aren't for staff.
  const locked = role.isSystem && role.name === "admin"
  const changed =
    keys.size !== role.permissions.length ||
    role.permissions.some((k) => !keys.has(k))
  const fail = (error: unknown) =>
    toast.add({
      title: t("failed"),
      description: isApiError(error) ? error.message : undefined,
      type: "error",
    })
  const save = useMutation({
    mutationFn: () => setRolePermissions(role.id, [...keys]),
    onSuccess: async () => {
      toast.add({ title: t("saved"), type: "success" })
      await queryClient.invalidateQueries({ queryKey: adminKeys.roles })
    },
    onError: fail,
  })
  const remove = useMutation({
    mutationFn: () => deleteRole(role.id),
    onSuccess: async () => {
      toast.add({ title: t("deleted"), type: "success" })
      onDeleted()
      await queryClient.invalidateQueries({ queryKey: adminKeys.roles })
    },
    onError: fail,
  })
  const toggle = (key: string, on: boolean) =>
    setKeys((old) => {
      const next = new Set(old)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="me-auto">
          <h2 className="text-lg font-semibold">{label(role)}</h2>
          <p className="text-sm text-muted-foreground">
            {role.description}
            {role.scope === "assigned" && (
              <span className="block">{t("assignedScope")}</span>
            )}
          </p>
        </div>
        <Can permission="roles:manage">
          {!locked && (
            <Button
              disabled={!changed || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? t("saving") : t("save")}
            </Button>
          )}
          <Button variant="outline" onClick={onClone}>
            <CopyIcon data-icon="inline-start" />
            {t("copy")}
          </Button>
          {!role.isSystem && (
            <Button
              variant="outline"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              <Trash2Icon data-icon="inline-start" />
              {t("delete")}
            </Button>
          )}
        </Can>
      </div>
      {locked && (
        <p className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm">
          <LockIcon className="size-4" />
          {t("adminLocked")}
        </p>
      )}
      {groups.isPending ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
          {(groups.data ?? [])
            .filter((g) => g.resource !== "portal")
            .map((g) => (
              <fieldset key={g.resource} className="flex flex-col gap-1">
                <legend className="mb-1 text-sm font-medium">
                  {humanize(g.resource)}
                </legend>
                {g.permissions.map((p) => (
                  <Label
                    key={p.key}
                    className="flex items-center gap-2 text-sm font-normal"
                  >
                    <Checkbox
                      checked={locked || keys.has(p.key)}
                      disabled={locked}
                      onCheckedChange={(on) => toggle(p.key, Boolean(on))}
                    />
                    {humanize(p.action)}
                  </Label>
                ))}
              </fieldset>
            ))}
        </div>
      )}
    </section>
  )
}

function CloneDialog({
  role,
  onClose,
  onCreated,
}: {
  role: RoleRow
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const t = useTranslations("adminScreens.roles")
  const label = useRoleLabel()
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const create = useMutation({
    mutationFn: () => cloneRole(role.id, name.trim()),
    onSuccess: async (r) => {
      toast.add({ title: t("created"), type: "success" })
      await queryClient.invalidateQueries({ queryKey: adminKeys.roles })
      onCreated(r.id)
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
    <Dialog open onOpenChange={(o) => !o && !create.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("cloneTitle", { name: label(role) })}</DialogTitle>
          <DialogDescription>{t("cloneHint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="role-name">{t("name")}</Label>
          <Input
            id="role-name"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            {t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
