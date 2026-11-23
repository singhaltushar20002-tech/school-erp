"use client"

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
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
import { isApiError } from "~/lib/api/errors"
import { cn } from "~/lib/utils"

export type FormValues = Record<string, string | boolean>

/** One input of the add/edit dialog. Labels arrive translated. */
export interface SetupField {
  name: string
  label: string
  type?: "text" | "number" | "date" | "time" | "select" | "checkbox"
  options?: { value: string; label: string }[]
  required?: boolean
  maxLength?: number
  /** Shown only when adding (the backend won't change it later). */
  createOnly?: boolean
  hint?: string
  wide?: boolean
}

export interface SetupColumn<T> {
  label: string
  cell: (row: T) => React.ReactNode
  className?: string
}

/**
 * A setup list (sessions, shifts, rooms, subjects…): a table with add,
 * edit and delete through a dialog. The caller maps rows to form values
 * and form values to the request body, so each screen stays a few lines.
 */
export function SetupTable<T extends { id: string }>({
  title,
  description,
  queryKey,
  invalidate,
  queryFn,
  columns,
  fields,
  toForm,
  emptyForm,
  onCreate,
  onUpdate,
  onDelete,
  rowName,
  permissions,
  emptyTitle,
  emptyBody,
  toolbar,
  enabled = true,
  waiting = false,
}: {
  title?: string
  description?: string
  queryKey: QueryKey
  /** Extra keys to refresh after a change (lists that show this data). */
  invalidate?: QueryKey[]
  queryFn: (signal: AbortSignal) => Promise<T[]>
  columns: SetupColumn<T>[]
  fields: SetupField[]
  toForm: (row: T) => FormValues
  emptyForm: FormValues
  onCreate?: (values: FormValues) => Promise<unknown>
  onUpdate?: (row: T, values: FormValues) => Promise<unknown>
  onDelete?: (row: T) => Promise<unknown>
  rowName: (row: T) => string
  permissions: { create?: string; update?: string; delete?: string }
  emptyTitle: string
  emptyBody?: string
  toolbar?: React.ReactNode
  enabled?: boolean
  /** The screen is still loading what this list depends on. */
  waiting?: boolean
}) {
  const t = useTranslations("setup")
  const queryClient = useQueryClient()
  const list = useQuery({
    queryKey,
    queryFn: ({ signal }) => queryFn(signal),
    enabled,
  })
  const [editing, setEditing] = useState<T | "new" | null>(null)
  const [removing, setRemoving] = useState<T | null>(null)
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey })
    for (const key of invalidate ?? [])
      await queryClient.invalidateQueries({ queryKey: key })
  }
  const fail = (error: unknown) =>
    toast.add({
      title: t("failed"),
      description: isApiError(error) ? error.message : undefined,
      type: "error",
    })
  const remove = useMutation({
    mutationFn: (row: T) => onDelete!(row),
    onSuccess: async () => {
      toast.add({ title: t("deleted"), type: "success" })
      setRemoving(null)
      await refresh()
    },
    onError: fail,
  })
  const rows = list.data ?? []
  const actions = Boolean(onUpdate || onDelete)

  return (
    <section className="flex flex-col gap-3">
      {(title || toolbar || onCreate) && (
        <div className="flex flex-wrap items-end gap-2">
          {title && (
            <div className="me-auto">
              <h2 className="text-lg font-semibold">{title}</h2>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
          )}
          {toolbar}
          {onCreate && (
            <Can permission={permissions.create}>
              <Button
                className={cn(!title && "ms-auto")}
                disabled={!enabled}
                onClick={() => setEditing("new")}
              >
                <PlusIcon data-icon="inline-start" />
                {t("add")}
              </Button>
            </Can>
          )}
        </div>
      )}
      {waiting || (list.isPending && enabled) ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : rows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            {emptyBody && <EmptyDescription>{emptyBody}</EmptyDescription>}
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.label} className={c.className}>
                    {c.label}
                  </TableHead>
                ))}
                {actions && (
                  <TableHead>
                    <span className="sr-only">{t("actions")}</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  {columns.map((c) => (
                    <TableCell key={c.label} className={c.className}>
                      {c.cell(row)}
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell className="w-0 text-right whitespace-nowrap">
                      {onUpdate && (
                        <Can permission={permissions.update}>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("editNamed", { name: rowName(row) })}
                            onClick={() => setEditing(row)}
                          >
                            <PencilIcon />
                          </Button>
                        </Can>
                      )}
                      {onDelete && (
                        <Can permission={permissions.delete}>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("deleteNamed", {
                              name: rowName(row),
                            })}
                            onClick={() => setRemoving(row)}
                          >
                            <Trash2Icon />
                          </Button>
                        </Can>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && (
        <SetupDialog
          title={editing === "new" ? t("addTitle") : rowName(editing)}
          fields={fields.filter((f) => editing === "new" || !f.createOnly)}
          initial={editing === "new" ? emptyForm : toForm(editing)}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            if (editing === "new") await onCreate!(values)
            else await onUpdate!(editing, values)
            toast.add({
              title: editing === "new" ? t("added") : t("saved"),
              type: "success",
            })
            await refresh()
            setEditing(null)
          }}
          onError={fail}
        />
      )}

      <AlertDialog
        open={removing !== null}
        onOpenChange={(open) => !open && !remove.isPending && setRemoving(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("deleteTitle", { name: removing ? rowName(removing) : "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("deleteBody")}</AlertDialogDescription>
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
              {remove.isPending ? t("deleting") : t("delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

/** The add/edit form, built from `fields`. */
export function SetupDialog({
  title,
  description,
  fields,
  initial,
  onClose,
  onSubmit,
  onError,
}: {
  title: string
  description?: string
  fields: SetupField[]
  initial: FormValues
  onClose: () => void
  onSubmit: (values: FormValues) => Promise<void>
  onError: (error: unknown) => void
}) {
  const t = useTranslations("setup")
  const [values, setValues] = useState<FormValues>(initial)
  const save = useMutation({
    mutationFn: () => onSubmit(values),
    onError,
  })
  const missing = fields.some(
    (f) => f.required && f.type !== "checkbox" && !String(values[f.name]).trim()
  )
  const set = (name: string, value: string | boolean) =>
    setValues((old) => ({ ...old, [name]: value }))

  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? t("dialogHint")}
          </DialogDescription>
        </DialogHeader>
        <form
          id="setup-form"
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!missing) save.mutate()
          }}
        >
          {fields.map((f) => {
            const id = `setup-${f.name}`
            if (f.type === "checkbox")
              return (
                <Label
                  key={f.name}
                  className="flex items-center gap-2 font-normal sm:col-span-2"
                >
                  <Checkbox
                    checked={Boolean(values[f.name])}
                    onCheckedChange={(v) => set(f.name, Boolean(v))}
                  />
                  {f.label}
                </Label>
              )
            return (
              <div
                key={f.name}
                className={cn(
                  "flex flex-col gap-1.5",
                  f.wide && "sm:col-span-2"
                )}
              >
                <Label htmlFor={id}>
                  {f.label}
                  {f.required && (
                    <span aria-hidden className="text-destructive">
                      {" "}
                      {t("requiredMark")}
                    </span>
                  )}
                </Label>
                {f.type === "select" ? (
                  <NativeSelect
                    id={id}
                    className="w-full"
                    value={String(values[f.name] ?? "")}
                    onChange={(e) => set(f.name, e.target.value)}
                  >
                    {!f.required && (
                      <NativeSelectOption value="">—</NativeSelectOption>
                    )}
                    {f.options?.map((o) => (
                      <NativeSelectOption key={o.value} value={o.value}>
                        {o.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                ) : (
                  <Input
                    id={id}
                    type={f.type ?? "text"}
                    min={f.type === "number" ? 0 : undefined}
                    maxLength={f.maxLength}
                    value={String(values[f.name] ?? "")}
                    onChange={(e) => set(f.name, e.target.value)}
                  />
                )}
                {f.hint && (
                  <p className="text-xs text-muted-foreground">{f.hint}</p>
                )}
              </div>
            )
          })}
        </form>
        <DialogFooter>
          <Button variant="outline" disabled={save.isPending} onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            form="setup-form"
            disabled={missing || save.isPending}
          >
            {save.isPending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Form helpers: blank strings become null, numbers parse. */
export const text = (v: FormValues, k: string) => {
  const s = String(v[k] ?? "").trim()
  return s === "" ? null : s
}
export const num = (v: FormValues, k: string) => {
  const s = String(v[k] ?? "").trim()
  return s === "" ? null : Number(s)
}
/** Drops nulls (create DTOs reject null on optional strings). */
export const compact = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(
    Object.entries(o).filter(([, value]) => value !== null)
  ) as Partial<T>
