"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PlusIcon, Trash2Icon } from "lucide-react"
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
import {
  useConsoleCan,
  useConsoleUser,
} from "~/features/platform/shell/components/admin-shell"
import { isApiError } from "~/lib/api/errors"

import {
  consoleKeys,
  createStaff,
  PLATFORM_ROLES,
  removeStaff,
  staffQuery,
  updateStaff,
  type PlatformRole,
} from "./api"
import { useConsoleFormat } from "./format"

/**
 * `/staff` on the admin host: the people who run the platform and what
 * their console role lets them do. Only super admins change it, and nobody
 * changes their own role or status.
 */
export function StaffScreen() {
  const t = useTranslations("console.staff")
  const tr = useTranslations("admin.menu.roles")
  const f = useConsoleFormat()
  const can = useConsoleCan()
  const me = useConsoleUser()
  const manage = can("platform_users:manage")
  const queryClient = useQueryClient()
  const staff = useQuery(staffQuery())
  const [adding, setAdding] = useState(false)
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: consoleKeys.staff })
  const run = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: async () => {
      toast.add({ title: t("saved"), type: "success" })
      await refresh()
    },
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-2">
        <div className="me-auto">
          <h1 className="font-display text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {manage && (
          <Button onClick={() => setAdding(true)}>
            <PlusIcon data-icon="inline-start" />
            {t("add")}
          </Button>
        )}
      </header>
      <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {PLATFORM_ROLES.map((r) => (
          <li key={r} className="rounded-lg border bg-card p-3">
            <span className="font-medium">{tr(r)}</span>
            <span className="block text-xs text-muted-foreground">
              {t(`roleHints.${r}`)}
            </span>
          </li>
        ))}
      </ul>
      {staff.isPending ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("role")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t("since")}
                </TableHead>
                <TableHead>
                  <span className="sr-only">{t("actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(staff.data ?? []).map((u) => {
                const self = u.id === me?.id
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <span className="font-medium">
                        {u.name}
                        {self && (
                          <Badge variant="outline" className="ms-2">
                            {t("you")}
                          </Badge>
                        )}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {u.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      {manage && !self ? (
                        <NativeSelect
                          size="sm"
                          aria-label={t("roleFor", { name: u.name ?? "" })}
                          value={u.platformRole}
                          disabled={run.isPending}
                          onChange={(e) =>
                            run.mutate(() =>
                              updateStaff(u.id, {
                                platformRole: e.target.value as
                                  PlatformRole | "user",
                              })
                            )
                          }
                        >
                          {PLATFORM_ROLES.map((r) => (
                            <NativeSelectOption key={r} value={r}>
                              {tr(r)}
                            </NativeSelectOption>
                          ))}
                          <NativeSelectOption value="user">
                            {t("noConsole")}
                          </NativeSelectOption>
                        </NativeSelect>
                      ) : u.platformRole === "user" ? (
                        t("noConsole")
                      ) : (
                        tr(u.platformRole)
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          u.status === "active" ? "secondary" : "destructive"
                        }
                      >
                        {t(`statuses.${u.status}`)}
                      </Badge>
                      {u.mustChangePassword && (
                        <span className="block text-xs text-muted-foreground">
                          {t("tempPassword")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {f.date(u.createdAt)}
                    </TableCell>
                    <TableCell className="w-0 text-right whitespace-nowrap">
                      {manage && !self && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={run.isPending}
                            onClick={() =>
                              run.mutate(() =>
                                updateStaff(u.id, {
                                  status:
                                    u.status === "suspended"
                                      ? "active"
                                      : "suspended",
                                })
                              )
                            }
                          >
                            {u.status === "suspended"
                              ? t("unblock")
                              : t("block")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("remove", { name: u.name ?? "" })}
                            disabled={run.isPending}
                            onClick={() => run.mutate(() => removeStaff(u.id))}
                          >
                            <Trash2Icon />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {adding && <AddStaffDialog onClose={() => setAdding(false)} />}
    </div>
  )
}

function AddStaffDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("console.staff")
  const tr = useTranslations("admin.menu.roles")
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<PlatformRole>("support")
  const add = useMutation({
    mutationFn: () =>
      createStaff({
        name: name.trim(),
        email: email.trim(),
        password,
        platformRole: role,
      }),
    onSuccess: async () => {
      toast.add({ title: t("added"), type: "success" })
      await queryClient.invalidateQueries({ queryKey: consoleKeys.staff })
      onClose()
    },
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  const valid = name.trim() && email.includes("@") && password.length >= 8
  return (
    <Dialog open onOpenChange={(o) => !o && !add.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("addTitle")}</DialogTitle>
          <DialogDescription>{t("addHint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ps-name">{t("name")}</Label>
            <Input
              id="ps-name"
              maxLength={160}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ps-email">{t("email")}</Label>
            <Input
              id="ps-email"
              type="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ps-pass">{t("password")}</Label>
            <Input
              id="ps-pass"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ps-role">{t("role")}</Label>
            <NativeSelect
              id="ps-role"
              className="w-full"
              value={role}
              onChange={(e) => setRole(e.target.value as PlatformRole)}
            >
              {PLATFORM_ROLES.map((r) => (
                <NativeSelectOption key={r} value={r}>
                  {tr(r)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!valid || add.isPending}
            onClick={() => add.mutate()}
          >
            {t("addConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
