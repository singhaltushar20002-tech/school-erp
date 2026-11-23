"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  KeyRoundIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

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
import { Can } from "~/features/access/can"
import {
  SetupDialog,
  text,
  type FormValues,
} from "~/features/academics/components/setup-table"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"

import {
  allEmployeesQuery,
  createEmployee,
  deleteEmployee,
  departmentsQuery,
  designationsQuery,
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
  GENDERS,
  inviteEmployee,
  isSystemRole,
  staffKeys,
  staffRolesQuery,
  updateEmployee,
  type Employee,
  type EmployeeStatus,
  type InviteResult,
} from "../api"

const STATUS_VARIANT: Record<
  EmployeeStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "secondary",
  on_leave: "outline",
  inactive: "outline",
  terminated: "destructive",
}

/**
 * `/dashboard/staff`: everyone on the payroll and timetable, with their
 * department, designation and whether they can sign in.
 */
export function StaffDirectory() {
  const t = useTranslations("staffSetup.directory")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const staff = useQuery(allEmployeesQuery())
  const departments = useQuery(departmentsQuery())
  const designations = useQuery(designationsQuery())
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<EmployeeStatus | "">("active")
  const [departmentId, setDepartmentId] = useState("")
  const [designationId, setDesignationId] = useState("")
  const [editing, setEditing] = useState<Employee | "new" | null>(null)
  const [removing, setRemoving] = useState<Employee | null>(null)
  const [inviting, setInviting] = useState<Employee | null>(null)

  const query = q.trim().toLowerCase()
  const shown = (staff.data ?? []).filter(
    (e) =>
      (!status || e.status === status) &&
      (!departmentId || e.departmentId === departmentId) &&
      (!designationId || e.designationId === designationId) &&
      (!query ||
        e.fullName.toLowerCase().includes(query) ||
        (e.employeeNumber ?? "").toLowerCase().includes(query) ||
        (e.phone ?? "").includes(query) ||
        (e.email ?? "").toLowerCase().includes(query))
  )
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: staffKeys.all })
  const fail = (error: unknown) =>
    toast.add({
      title: t("failed"),
      description: isApiError(error) ? error.message : undefined,
      type: "error",
    })
  const remove = useMutation({
    mutationFn: (e: Employee) => deleteEmployee(e.id),
    onSuccess: async () => {
      toast.add({ title: t("removed"), type: "success" })
      setRemoving(null)
      await refresh()
    },
    onError: fail,
  })

  /** On create blanks are left out; on update they clear the field. */
  const body = (v: FormValues, update: boolean) => {
    const blank = update ? null : undefined
    const opt = (k: string) => text(v, k) ?? blank
    return {
      firstName: text(v, "firstName"),
      lastName: text(v, "lastName"),
      employeeNumber: text(v, "employeeNumber") ?? undefined,
      status: text(v, "status") ?? undefined,
      phone: opt("phone"),
      email: opt("email"),
      gender: opt("gender"),
      dob: opt("dob"),
      joiningDate: opt("joiningDate"),
      qualification: opt("qualification"),
      employmentType: opt("employmentType"),
      departmentId: opt("departmentId"),
      designationId: opt("designationId"),
      address: opt("address"),
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={t("search")}
            placeholder={t("search")}
            className="ps-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <NativeSelect
          aria-label={t("status")}
          value={status}
          onChange={(e) => setStatus(e.target.value as EmployeeStatus | "")}
        >
          <NativeSelectOption value="">{t("allStatuses")}</NativeSelectOption>
          {EMPLOYEE_STATUSES.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {t(`statuses.${s}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t("department")}
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
        >
          <NativeSelectOption value="">
            {t("allDepartments")}
          </NativeSelectOption>
          {(departments.data ?? []).map((d) => (
            <NativeSelectOption key={d.id} value={d.id}>
              {d.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t("designation")}
          value={designationId}
          onChange={(e) => setDesignationId(e.target.value)}
        >
          <NativeSelectOption value="">
            {t("allDesignations")}
          </NativeSelectOption>
          {(designations.data ?? []).map((d) => (
            <NativeSelectOption key={d.id} value={d.id}>
              {d.title}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Can permission="employees:create">
          <Button className="ms-auto" onClick={() => setEditing("new")}>
            <PlusIcon data-icon="inline-start" />
            {t("add")}
          </Button>
        </Can>
      </div>

      {staff.isPending ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : shown.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("empty")}</EmptyTitle>
            <EmptyDescription>{t("emptyBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t("count", { count: shown.length, n: f.number(shown.length) })}
          </p>
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("designation")}</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t("department")}
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t("phone")}
                  </TableHead>
                  <TableHead>{t("signIn")}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t("actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <span className="flex flex-wrap items-center gap-2 font-medium">
                        {e.fullName}
                        {e.status !== "active" && (
                          <Badge variant={STATUS_VARIANT[e.status]}>
                            {t(`statuses.${e.status}`)}
                          </Badge>
                        )}
                      </span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {e.employeeNumber}
                        {e.joiningDate &&
                          ` · ${t("joined", { date: f.date(e.joiningDate) })}`}
                      </span>
                    </TableCell>
                    <TableCell>{e.designation?.title ?? "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {e.department?.name ?? "—"}
                    </TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">
                      {e.phone ?? e.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      {e.userId ? (
                        <Badge variant="secondary">{t("hasAccount")}</Badge>
                      ) : (
                        <Can
                          permission="users:create"
                          fallback={
                            <span className="text-sm text-muted-foreground">
                              {t("noAccount")}
                            </span>
                          }
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!e.phone && !e.email}
                            title={
                              !e.phone && !e.email
                                ? t("inviteNeedsContact")
                                : undefined
                            }
                            onClick={() => setInviting(e)}
                          >
                            <KeyRoundIcon data-icon="inline-start" />
                            {t("invite")}
                          </Button>
                        </Can>
                      )}
                    </TableCell>
                    <TableCell className="w-0 text-right whitespace-nowrap">
                      <Can permission="employees:update">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("edit", { name: e.fullName })}
                          onClick={() => setEditing(e)}
                        >
                          <PencilIcon />
                        </Button>
                      </Can>
                      <Can permission="employees:delete">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("remove", { name: e.fullName })}
                          onClick={() => setRemoving(e)}
                        >
                          <Trash2Icon />
                        </Button>
                      </Can>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {editing && (
        <SetupDialog
          title={editing === "new" ? t("addTitle") : editing.fullName}
          description={t("formHint")}
          initial={
            editing === "new"
              ? {
                  firstName: "",
                  lastName: "",
                  employeeNumber: "",
                  phone: "",
                  email: "",
                  gender: "",
                  dob: "",
                  joiningDate: "",
                  qualification: "",
                  employmentType: "permanent",
                  status: "active",
                  departmentId: "",
                  designationId: "",
                  address: "",
                }
              : {
                  firstName: editing.firstName,
                  lastName: editing.lastName,
                  employeeNumber: editing.employeeNumber ?? "",
                  phone: editing.phone ?? "",
                  email: editing.email ?? "",
                  gender: editing.gender ?? "",
                  dob: editing.dob ?? "",
                  joiningDate: editing.joiningDate ?? "",
                  qualification: editing.qualification ?? "",
                  employmentType: editing.employmentType ?? "",
                  status: editing.status,
                  departmentId: editing.departmentId ?? "",
                  designationId: editing.designationId ?? "",
                  address: editing.address ?? "",
                }
          }
          fields={[
            {
              name: "firstName",
              label: t("firstName"),
              required: true,
              maxLength: 80,
            },
            {
              name: "lastName",
              label: t("lastName"),
              required: true,
              maxLength: 80,
            },
            {
              name: "designationId",
              label: t("designation"),
              type: "select",
              options: (designations.data ?? []).map((d) => ({
                value: d.id,
                label: d.title,
              })),
            },
            {
              name: "departmentId",
              label: t("department"),
              type: "select",
              options: (departments.data ?? []).map((d) => ({
                value: d.id,
                label: d.name,
              })),
            },
            { name: "phone", label: t("phone"), maxLength: 20 },
            { name: "email", label: t("email"), maxLength: 160 },
            {
              name: "employeeNumber",
              label: t("employeeNumber"),
              maxLength: 60,
              hint: editing === "new" ? t("employeeNumberHint") : undefined,
            },
            { name: "joiningDate", label: t("joiningDate"), type: "date" },
            {
              name: "employmentType",
              label: t("employmentType"),
              type: "select",
              options: EMPLOYMENT_TYPES.map((x) => ({
                value: x,
                label: t(`employmentTypes.${x}`),
              })),
            },
            {
              name: "status",
              label: t("status"),
              type: "select",
              required: true,
              options: EMPLOYEE_STATUSES.map((x) => ({
                value: x,
                label: t(`statuses.${x}`),
              })),
            },
            {
              name: "gender",
              label: t("gender"),
              type: "select",
              options: GENDERS.map((x) => ({
                value: x,
                label: t(`genders.${x}`),
              })),
            },
            { name: "dob", label: t("dob"), type: "date" },
            {
              name: "qualification",
              label: t("qualification"),
              maxLength: 255,
              wide: true,
            },
            { name: "address", label: t("address"), wide: true },
          ]}
          onClose={() => setEditing(null)}
          onError={fail}
          onSubmit={async (v) => {
            if (editing === "new") await createEmployee(body(v, false))
            else await updateEmployee(editing.id, body(v, true))
            toast.add({
              title: editing === "new" ? t("added") : t("saved"),
              type: "success",
            })
            await refresh()
            setEditing(null)
          }}
        />
      )}

      {inviting && (
        <InviteDialog
          employee={inviting}
          defaultRoleId={
            designations.data?.find((d) => d.id === inviting.designationId)
              ?.defaultRoleId ?? null
          }
          onClose={() => setInviting(null)}
          onDone={refresh}
        />
      )}

      <AlertDialog
        open={removing !== null}
        onOpenChange={(open) => !open && !remove.isPending && setRemoving(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("removeTitle", { name: removing?.fullName ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("removeBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              {t("cancel")}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => removing && remove.mutate(removing)}
            >
              {t("removeConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** Gives a staff member a sign-in with the chosen roles. */
function InviteDialog({
  employee,
  defaultRoleId,
  onClose,
  onDone,
}: {
  employee: Employee
  defaultRoleId: string | null
  onClose: () => void
  onDone: () => Promise<unknown>
}) {
  const t = useTranslations("staffSetup.directory")
  const tr = useTranslations("staffSetup.roles")
  const roles = useQuery(staffRolesQuery())
  const [picked, setPicked] = useState<Set<string>>(
    new Set(defaultRoleId ? [defaultRoleId] : [])
  )
  const [result, setResult] = useState<InviteResult | null>(null)
  const send = useMutation({
    mutationFn: () => inviteEmployee(employee.id, [...picked]),
    onSuccess: async (r) => {
      setResult(r)
      await onDone()
    },
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  const label = (name: string, isSystem: boolean) =>
    isSystem && isSystemRole(name) ? tr(name) : name

  return (
    <Dialog open onOpenChange={(o) => !o && !send.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("inviteTitle", { name: employee.fullName })}
          </DialogTitle>
          <DialogDescription>
            {employee.email
              ? t("inviteByEmail", { email: employee.email })
              : t("inviteBySlip", { phone: employee.phone ?? "" })}
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="flex flex-col gap-2 rounded-lg bg-muted p-3 text-sm">
            {result.delivery === "slip" ? (
              <>
                <p>{t("slipShown")}</p>
                <p className="font-mono text-lg font-semibold tracking-wider">
                  {result.temporaryPassword}
                </p>
              </>
            ) : result.delivery === "email" ? (
              <p>{t("emailSent")}</p>
            ) : (
              <p>{t("linkedExisting")}</p>
            )}
          </div>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("roles")}</legend>
            {(roles.data ?? []).map((r) => (
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
                  {label(r.name, r.isSystem)}
                  {r.description && (
                    <span className="text-xs text-muted-foreground">
                      {r.description}
                    </span>
                  )}
                </span>
              </Label>
            ))}
          </fieldset>
        )}
        <DialogFooter>
          {result ? (
            <Button onClick={onClose}>{t("done")}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                {t("cancel")}
              </Button>
              <Button
                disabled={picked.size === 0 || send.isPending}
                onClick={() => send.mutate()}
              >
                {send.isPending ? t("inviting") : t("inviteSend")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
