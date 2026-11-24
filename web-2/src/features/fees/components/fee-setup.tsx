"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "~/components/ui/input-group"
import { Label } from "~/components/ui/label"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { Skeleton } from "~/components/ui/skeleton"
import { Switch } from "~/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { toast } from "~/components/ui/toast"
import { classesQuery, currentSessionQuery } from "~/features/academics/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"
import { currencySymbol } from "~/lib/format"
import { cn } from "~/lib/utils"

import {
  DISCOUNT_CODES,
  discountTypesQuery,
  feeHeadsQuery,
  feeStructuresQuery,
  FREQUENCIES,
  lateFinesQuery,
  percentOf,
  saveDiscountType,
  saveFeeHead,
  saveFineRule,
  saveStructure,
  setupKeys,
  type DiscountCode,
  type DiscountType,
  type FeeFrequency,
  type FeeHead,
  type FeeStructure,
  type LateFineRule,
} from "../setup-api"

/** Calendar months in session order (April first). */
const MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const
const sessionOrder = (m: number) => (m + 8) % 12

/** Bills a year for one item: its months, else what its head's frequency gives. */
const billsPerYear = (frequency: FeeFrequency, months?: number[] | null) =>
  months?.length
    ? months.length
    : frequency === "monthly"
      ? 12
      : frequency === "quarterly"
        ? 4
        : 1

function useSaved() {
  const t = useTranslations("fees.setup")
  const queryClient = useQueryClient()
  return {
    onSuccess: async () => {
      toast.add({ title: t("saved"), type: "success" })
      await queryClient.invalidateQueries({ queryKey: setupKeys.all })
    },
    onError: (error: unknown) =>
      toast.add({
        title: t("saveFailed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  }
}

/** `/dashboard/fees/setup`: what each class pays, and the rules around it. */
export function FeeSetup() {
  const t = useTranslations("fees.setup")
  return (
    <Tabs defaultValue="structures" className="flex flex-col gap-4">
      <TabsList className="w-fit flex-wrap">
        <TabsTrigger value="structures">{t("tabs.structures")}</TabsTrigger>
        <TabsTrigger value="heads">{t("tabs.heads")}</TabsTrigger>
        <TabsTrigger value="concessions">{t("tabs.concessions")}</TabsTrigger>
        <TabsTrigger value="fines">{t("tabs.fines")}</TabsTrigger>
      </TabsList>
      <TabsContent value="structures">
        <Structures />
      </TabsContent>
      <TabsContent value="heads">
        <Heads />
      </TabsContent>
      <TabsContent value="concessions">
        <ConcessionTypes />
      </TabsContent>
      <TabsContent value="fines">
        <Fines />
      </TabsContent>
    </Tabs>
  )
}

// --- Structures -----------------------------------------------------------

function Structures() {
  const t = useTranslations("fees.setup")
  const f = useSchoolFormat()
  const session = useQuery(currentSessionQuery())
  const yearId = session.data?.id ?? ""
  const classes = useQuery(classesQuery())
  const heads = useQuery(feeHeadsQuery())
  const structures = useQuery({
    ...feeStructuresQuery(yearId),
    enabled: Boolean(yearId),
  })
  const [editing, setEditing] = useState<{
    classId: string
    className: string
    structure: FeeStructure | null
  } | null>(null)

  if (session.isPending || classes.isPending || structures.isPending) {
    return <Skeleton className="h-64 rounded-xl" />
  }
  if (!session.data) {
    return <p className="text-sm text-muted-foreground">{t("noSession")}</p>
  }
  const headOf = (id: string) => heads.data?.find((h) => h.id === id)
  const sorted = (classes.data ?? [])
    .slice()
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {t("structuresHint", { session: session.data.name })}
      </p>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("class")}</TableHead>
              <TableHead>{t("items")}</TableHead>
              <TableHead className="text-right">{t("monthly")}</TableHead>
              <TableHead className="text-right">{t("yearly")}</TableHead>
              <TableHead>
                <span className="sr-only">{t("actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((c) => {
              const s = structures.data?.find((x) => x.classId === c.id) ?? null
              const monthly = (s?.items ?? [])
                .filter((i) => {
                  const h = i.feeHead ?? headOf(i.feeHeadId)
                  return h?.frequency === "monthly" && !i.months?.length
                })
                .reduce((n, i) => n + i.amount, 0)
              const yearly = (s?.items ?? []).reduce((n, i) => {
                const h = i.feeHead ?? headOf(i.feeHeadId)
                return (
                  n +
                  i.amount * billsPerYear(h?.frequency ?? "yearly", i.months)
                )
              }, 0)
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    {s ? (
                      <span className="flex flex-wrap gap-1">
                        {s.items
                          .slice()
                          .sort(
                            (x, y) =>
                              ((x.feeHead ?? headOf(x.feeHeadId))?.sortOrder ??
                                0) -
                              ((y.feeHead ?? headOf(y.feeHeadId))?.sortOrder ??
                                0)
                          )
                          .map((i) => (
                            <Badge key={i.feeHeadId} variant="outline">
                              {(i.feeHead ?? headOf(i.feeHeadId))?.name}{" "}
                              {f.moneyShort(i.amount)}
                            </Badge>
                          ))}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {t("noStructure")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s ? f.moneyShort(monthly) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {s ? f.moneyShort(yearly) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setEditing({
                          classId: c.id,
                          className: c.name,
                          structure: s,
                        })
                      }
                    >
                      {s ? (
                        <PencilIcon data-icon="inline-start" />
                      ) : (
                        <PlusIcon data-icon="inline-start" />
                      )}
                      {s ? t("edit") : t("create")}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {editing && (
        <StructureDialog
          key={editing.classId}
          academicYearId={session.data.id}
          sessionName={session.data.name}
          classId={editing.classId}
          className={editing.className}
          structure={editing.structure}
          heads={(heads.data ?? []).filter((h) => h.isActive)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

interface ItemDraft {
  feeHeadId: string
  amount: string
  months: number[]
}

function StructureDialog({
  academicYearId,
  sessionName,
  classId,
  className,
  structure,
  heads,
  onClose,
}: {
  academicYearId: string
  sessionName: string
  classId: string
  className: string
  structure: FeeStructure | null
  heads: FeeHead[]
  onClose: () => void
}) {
  const t = useTranslations("fees.setup")
  const f = useSchoolFormat()
  const [items, setItems] = useState<ItemDraft[]>(
    structure?.items
      .slice()
      .sort(
        (x, y) =>
          (heads.find((h) => h.id === x.feeHeadId)?.sortOrder ?? 0) -
          (heads.find((h) => h.id === y.feeHeadId)?.sortOrder ?? 0)
      )
      .map((i) => ({
        feeHeadId: i.feeHeadId,
        amount: String(i.amount / 100),
        months: i.months ?? [],
      })) ?? []
  )
  const saved = useSaved()
  const save = useMutation({
    mutationFn: () =>
      saveStructure(
        {
          name: structure?.name ?? `${className} (${sessionName})`,
          academicYearId,
          classId,
          items: items.map((i) => ({
            feeHeadId: i.feeHeadId,
            amount: Math.round(Number(i.amount) * 100),
            months: i.months.length ? i.months : null,
          })),
        },
        structure?.id
      ),
    onError: saved.onError,
  })
  const used = new Set(items.map((i) => i.feeHeadId))
  const free = heads.filter((h) => !used.has(h.id))
  const valid =
    items.length > 0 &&
    items.every(
      (i) => i.feeHeadId && Number(i.amount) >= 0 && i.amount.trim() !== ""
    )
  const update = (k: number, patch: Partial<ItemDraft>) =>
    setItems((list) => list.map((x, i) => (i === k ? { ...x, ...patch } : x)))

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("structureTitle", { className })}</DialogTitle>
          <DialogDescription>{t("structureHint")}</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-3">
          {items.map((item, k) => {
            const head = heads.find((h) => h.id === item.feeHeadId)
            return (
              <li key={k} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                    <Label htmlFor={`head-${k}`}>{t("head")}</Label>
                    <NativeSelect
                      id={`head-${k}`}
                      className="w-full"
                      value={item.feeHeadId}
                      onChange={(e) => update(k, { feeHeadId: e.target.value })}
                    >
                      {heads
                        .filter(
                          (h) => h.id === item.feeHeadId || !used.has(h.id)
                        )
                        .map((h) => (
                          <NativeSelectOption key={h.id} value={h.id}>
                            {h.name}
                          </NativeSelectOption>
                        ))}
                    </NativeSelect>
                  </div>
                  <div className="flex w-36 flex-col gap-1.5">
                    <Label htmlFor={`amount-${k}`}>{t("amount")}</Label>
                    <InputGroup>
                      <InputGroupAddon>
                        <InputGroupText>
                          {currencySymbol(f.currency)}
                        </InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        id={`amount-${k}`}
                        inputMode="decimal"
                        value={item.amount}
                        onChange={(e) =>
                          update(k, {
                            amount: e.target.value.replace(/[^\d.]/g, ""),
                          })
                        }
                      />
                    </InputGroup>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("removeItem", { head: head?.name ?? "" })}
                    onClick={() =>
                      setItems((list) => list.filter((_, i) => i !== k))
                    }
                  >
                    <Trash2Icon />
                  </Button>
                </div>
                <fieldset className="flex flex-col gap-1.5">
                  <legend className="mb-1 text-xs text-muted-foreground">
                    {item.months.length
                      ? t("billedIn")
                      : t("billedAsHead", {
                          frequency: head
                            ? t(`frequency.${head.frequency}`)
                            : "",
                        })}
                  </legend>
                  <div className="flex flex-wrap gap-1">
                    {MONTHS.map((m) => {
                      const on = item.months.includes(m)
                      return (
                        <button
                          key={m}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            update(k, {
                              months: on
                                ? item.months.filter((x) => x !== m)
                                : [...item.months, m].sort(
                                    (a, b) => sessionOrder(a) - sessionOrder(b)
                                  ),
                            })
                          }
                          className={cn(
                            "rounded-md border px-2 py-1 text-xs",
                            on &&
                              "border-primary bg-primary text-primary-foreground"
                          )}
                        >
                          {t(`months.m${m}`)}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              </li>
            )
          })}
        </ul>
        {free.length > 0 && (
          <Button
            variant="outline"
            className="w-fit"
            onClick={() =>
              setItems((list) => [
                ...list,
                { feeHeadId: free[0].id, amount: "", months: [] },
              ])
            }
          >
            <PlusIcon data-icon="inline-start" />
            {t("addItem")}
          </Button>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!valid || save.isPending}
            onClick={() =>
              save.mutate(undefined, {
                onSuccess: async () => {
                  await saved.onSuccess()
                  onClose()
                },
              })
            }
          >
            {save.isPending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Fee heads ------------------------------------------------------------

function Heads() {
  const t = useTranslations("fees.setup")
  const heads = useQuery(feeHeadsQuery())
  const saved = useSaved()
  const [name, setName] = useState("")
  const [frequency, setFrequency] = useState<FeeFrequency>("monthly")
  const add = useMutation({
    mutationFn: () => saveFeeHead({ name: name.trim(), frequency }),
    ...saved,
    onSuccess: async () => {
      setName("")
      await saved.onSuccess()
    },
  })
  const toggle = useMutation({
    mutationFn: (h: FeeHead) => saveFeeHead({ isActive: !h.isActive }, h.id),
    ...saved,
  })

  if (heads.isPending) return <Skeleton className="h-64 rounded-xl" />
  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim().length >= 2) add.mutate()
        }}
      >
        <div className="flex min-w-48 flex-1 flex-col gap-1.5 sm:max-w-xs">
          <Label htmlFor="new-head">{t("newHead")}</Label>
          <Input
            id="new-head"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("newHeadPlaceholder")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-head-frequency">{t("frequencyLabel")}</Label>
          <NativeSelect
            id="new-head-frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as FeeFrequency)}
          >
            {FREQUENCIES.map((fr) => (
              <NativeSelectOption key={fr} value={fr}>
                {t(`frequency.${fr}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button
          type="submit"
          disabled={name.trim().length < 2 || add.isPending}
        >
          <PlusIcon data-icon="inline-start" />
          {t("add")}
        </Button>
      </form>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("head")}</TableHead>
              <TableHead>{t("frequencyLabel")}</TableHead>
              <TableHead className="text-right">{t("active")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(heads.data ?? []).map((h) => (
              <TableRow key={h.id}>
                <TableCell className="font-medium">{h.name}</TableCell>
                <TableCell>{t(`frequency.${h.frequency}`)}</TableCell>
                <TableCell className="text-right">
                  <Switch
                    aria-label={t("activeFor", { head: h.name })}
                    checked={h.isActive}
                    onCheckedChange={() => toggle.mutate(h)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// --- Concession types -----------------------------------------------------

function ConcessionTypes() {
  const t = useTranslations("fees.setup")
  const f = useSchoolFormat()
  const types = useQuery(discountTypesQuery())
  const heads = useQuery(feeHeadsQuery())
  const [open, setOpen] = useState(false)
  const describe = (d: DiscountType) => {
    const amount =
      d.kind === "percent" ? `${percentOf(d.value)}%` : f.moneyShort(d.value)
    const on = d.appliesToHeadIds.length
      ? d.appliesToHeadIds
          .map((id) => heads.data?.find((h) => h.id === id)?.name)
          .filter(Boolean)
          .join(", ")
      : t("allHeads")
    return t("concessionOf", { amount, on })
  }
  if (types.isPending) return <Skeleton className="h-64 rounded-xl" />
  return (
    <div className="flex flex-col gap-3">
      <Button className="w-fit" onClick={() => setOpen(true)}>
        <PlusIcon data-icon="inline-start" />
        {t("newConcession")}
      </Button>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("concession")}</TableHead>
              <TableHead>{t("kindLabel")}</TableHead>
              <TableHead>{t("gives")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(types.data ?? []).map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">
                  {d.name}
                  {!d.isActive && (
                    <Badge variant="outline" className="ml-2">
                      {t("inactive")}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {(DISCOUNT_CODES as string[]).includes(d.code)
                    ? t(`codes.${d.code as DiscountCode}`)
                    : d.code}
                </TableCell>
                <TableCell>{describe(d)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {open && (
        <ConcessionDialog
          heads={(heads.data ?? []).filter((h) => h.isActive)}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

function ConcessionDialog({
  heads,
  onClose,
}: {
  heads: FeeHead[]
  onClose: () => void
}) {
  const t = useTranslations("fees.setup")
  const f = useSchoolFormat()
  const saved = useSaved()
  const [name, setName] = useState("")
  const [code, setCode] = useState<DiscountCode>("custom")
  const [kind, setKind] = useState<"percent" | "fixed">("percent")
  const [value, setValue] = useState("")
  const [on, setOn] = useState<string[]>([])
  const n = Number(value)
  const valid =
    name.trim().length >= 2 &&
    value !== "" &&
    n > 0 &&
    (kind === "fixed" || n <= 100)
  const save = useMutation({
    mutationFn: () =>
      saveDiscountType({
        name: name.trim(),
        code,
        kind,
        value: Math.round(n * 100),
        appliesToHeadIds: on,
      }),
    ...saved,
    onSuccess: async () => {
      await saved.onSuccess()
      onClose()
    },
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("newConcession")}</DialogTitle>
          <DialogDescription>{t("concessionHint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-name">{t("concessionName")}</Label>
            <Input
              id="c-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("concessionNamePlaceholder")}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-code">{t("kindLabel")}</Label>
              <NativeSelect
                id="c-code"
                className="w-full"
                value={code}
                onChange={(e) => {
                  const c = e.target.value as DiscountCode
                  setCode(c)
                  if (c === "rte") {
                    setKind("percent")
                    setValue("100")
                  }
                }}
              >
                {DISCOUNT_CODES.map((c) => (
                  <NativeSelectOption key={c} value={c}>
                    {t(`codes.${c}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-kind">{t("valueType")}</Label>
              <NativeSelect
                id="c-kind"
                className="w-full"
                value={kind}
                onChange={(e) => setKind(e.target.value as "percent" | "fixed")}
              >
                <NativeSelectOption value="percent">
                  {t("percent")}
                </NativeSelectOption>
                <NativeSelectOption value="fixed">
                  {t("fixed")}
                </NativeSelectOption>
              </NativeSelect>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-value">{t("value")}</Label>
            <InputGroup className="max-w-40">
              <InputGroupAddon>
                <InputGroupText>
                  {kind === "percent" ? "%" : currencySymbol(f.currency)}
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="c-value"
                inputMode="decimal"
                value={value}
                onChange={(e) =>
                  setValue(e.target.value.replace(/[^\d.]/g, ""))
                }
              />
            </InputGroup>
          </div>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-medium">
              {t("appliesTo")}
            </legend>
            <p className="text-xs text-muted-foreground">
              {t("appliesToHint")}
            </p>
            <div className="flex flex-wrap gap-1">
              {heads.map((h) => {
                const sel = on.includes(h.id)
                return (
                  <button
                    key={h.id}
                    type="button"
                    aria-pressed={sel}
                    onClick={() =>
                      setOn((l) =>
                        sel ? l.filter((x) => x !== h.id) : [...l, h.id]
                      )
                    }
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs",
                      sel && "border-primary bg-primary text-primary-foreground"
                    )}
                  >
                    {h.name}
                  </button>
                )
              })}
            </div>
          </fieldset>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!valid || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Late fines -----------------------------------------------------------

function Fines() {
  const t = useTranslations("fees.setup")
  const f = useSchoolFormat()
  const rules = useQuery(lateFinesQuery())
  const saved = useSaved()
  const [open, setOpen] = useState(false)
  const toggle = useMutation({
    mutationFn: (r: LateFineRule) =>
      saveFineRule({ isActive: !r.isActive }, r.id),
    ...saved,
  })
  const describe = (r: LateFineRule) =>
    r.kind === "fixed"
      ? t("fineFixed", {
          amount: f.moneyShort(r.amount),
          days: f.number(r.graceDays ?? 0),
        })
      : t("finePerDay", {
          amount: f.moneyShort(r.amount),
          days: f.number(r.graceDays ?? 0),
          max: r.maxAmount ? f.moneyShort(r.maxAmount) : t("noMax"),
        })
  if (rules.isPending) return <Skeleton className="h-40 rounded-xl" />
  return (
    <div className="flex flex-col gap-3">
      <Button className="w-fit" onClick={() => setOpen(true)}>
        <PlusIcon data-icon="inline-start" />
        {t("newFine")}
      </Button>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("fineName")}</TableHead>
              <TableHead>{t("rule")}</TableHead>
              <TableHead className="text-right">{t("active")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rules.data ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{describe(r)}</TableCell>
                <TableCell className="text-right">
                  <Switch
                    aria-label={t("activeFor", { head: r.name })}
                    checked={r.isActive}
                    onCheckedChange={() => toggle.mutate(r)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {open && <FineDialog onClose={() => setOpen(false)} />}
    </div>
  )
}

function FineDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("fees.setup")
  const f = useSchoolFormat()
  const saved = useSaved()
  const [name, setName] = useState("")
  const [kind, setKind] = useState<"fixed" | "per_day">("fixed")
  const [amount, setAmount] = useState("")
  const [grace, setGrace] = useState("10")
  const [max, setMax] = useState("")
  const valid = name.trim().length >= 2 && Number(amount) > 0
  const save = useMutation({
    mutationFn: () =>
      saveFineRule({
        name: name.trim(),
        kind,
        amount: Math.round(Number(amount) * 100),
        graceDays: grace === "" ? null : Number(grace),
        maxAmount:
          kind === "per_day" && max !== ""
            ? Math.round(Number(max) * 100)
            : null,
      }),
    ...saved,
    onSuccess: async () => {
      await saved.onSuccess()
      onClose()
    },
  })
  const money = (id: string, v: string, set: (s: string) => void) => (
    <InputGroup>
      <InputGroupAddon>
        <InputGroupText>{currencySymbol(f.currency)}</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        inputMode="decimal"
        value={v}
        onChange={(e) => set(e.target.value.replace(/[^\d.]/g, ""))}
      />
    </InputGroup>
  )
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("newFine")}</DialogTitle>
          <DialogDescription>{t("fineHint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fine-name">{t("fineName")}</Label>
            <Input
              id="fine-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fine-kind">{t("rule")}</Label>
            <NativeSelect
              id="fine-kind"
              className="w-full"
              value={kind}
              onChange={(e) => setKind(e.target.value as "fixed" | "per_day")}
            >
              <NativeSelectOption value="fixed">
                {t("fineKindFixed")}
              </NativeSelectOption>
              <NativeSelectOption value="per_day">
                {t("fineKindPerDay")}
              </NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fine-amount">{t("amount")}</Label>
              {money("fine-amount", amount, setAmount)}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fine-grace">{t("graceDays")}</Label>
              <Input
                id="fine-grace"
                inputMode="numeric"
                value={grace}
                onChange={(e) => setGrace(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>
          {kind === "per_day" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fine-max">{t("maxFine")}</Label>
              {money("fine-max", max, setMax)}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!valid || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
