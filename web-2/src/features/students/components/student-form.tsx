"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { Skeleton } from "~/components/ui/skeleton"
import { toast } from "~/components/ui/toast"
import {
  classesQuery,
  currentSessionQuery,
  sectionsQuery,
} from "~/features/academics/api"
import { displaySettingsQuery } from "~/features/settings/api"
import { isApiError } from "~/lib/api/errors"
import { todayIn } from "~/lib/format"
import { apiFetchPage } from "~/lib/api/client"
import { normalizePhone } from "~/lib/phone"

import {
  attachGuardian,
  BLOOD_GROUPS,
  createStudent,
  enrollStudent,
  findGuardianByPhone,
  studentOverviewQuery,
  updateStudent,
  type Student,
  type StudentInput,
  type StudentRow,
} from "../api"

interface Values {
  firstName: string
  lastName: string
  gender: "" | "male" | "female" | "other"
  dob: string
  religion: string
  bloodGroup: string
  admissionDate: string
  admissionType: "new" | "transfer" | "readmission"
  previousSchool: string
}

const fromStudent = (s: Student, today: string): Values => ({
  firstName: s.firstName,
  lastName: s.lastName ?? "",
  gender: s.gender ?? "",
  dob: s.dob ?? "",
  religion: s.religion ?? "",
  bloodGroup: s.bloodGroup ?? "",
  admissionDate: s.admissionDate ?? today,
  admissionType: "new",
  previousSchool: s.previousSchool ?? "",
})

const toInput = (v: Values): StudentInput => ({
  firstName: v.firstName.trim(),
  lastName: v.lastName.trim(),
  ...(v.gender ? { gender: v.gender } : {}),
  ...(v.dob ? { dob: v.dob } : {}),
  ...(v.religion.trim() ? { religion: v.religion.trim() } : {}),
  ...(v.bloodGroup ? { bloodGroup: v.bloodGroup } : {}),
  ...(v.admissionDate ? { admissionDate: v.admissionDate } : {}),
  ...(v.previousSchool.trim()
    ? { previousSchool: v.previousSchool.trim() }
    : {}),
})

/** `/dashboard/students/new`: admit a student, place them, link parents. */
export function AdmitStudent() {
  const display = useQuery(displaySettingsQuery())
  const today = todayIn(display.data?.locale.timeZone)
  return (
    <StudentForm
      initial={{
        firstName: "",
        lastName: "",
        gender: "",
        dob: "",
        religion: "",
        bloodGroup: "",
        admissionDate: today,
        admissionType: "new",
        previousSchool: "",
      }}
    />
  )
}

/** `/dashboard/students/[id]/edit`: correct a student's details. */
export function EditStudent({ id }: { id: string }) {
  const display = useQuery(displaySettingsQuery())
  const today = todayIn(display.data?.locale.timeZone)
  const overview = useQuery(studentOverviewQuery(id))
  if (overview.isPending)
    return <Skeleton className="h-96 max-w-3xl rounded-xl" />
  if (overview.isError) return null
  return (
    <StudentForm id={id} initial={fromStudent(overview.data.profile, today)} />
  )
}

function StudentForm({ id, initial }: { id?: string; initial: Values }) {
  const t = useTranslations("students.form")
  const router = useRouter()
  const queryClient = useQueryClient()
  const [v, setV] = useState<Values>(initial)
  const set = <K extends keyof Values>(k: K, value: Values[K]) =>
    setV((old) => ({ ...old, [k]: value }))
  const admitting = !id

  // Placement and parents (admission only).
  const session = useQuery({ ...currentSessionQuery(), enabled: admitting })
  const classes = useQuery({ ...classesQuery(), enabled: admitting })
  const sections = useQuery({
    ...sectionsQuery(session.data?.id ?? ""),
    enabled: admitting && Boolean(session.data?.id),
  })
  const [classId, setClassId] = useState("")
  const [sectionId, setSectionId] = useState("")
  const [roll, setRoll] = useState("")
  const [father, setFather] = useState({ name: "", phone: "" })
  const [mother, setMother] = useState({ name: "", phone: "" })
  const [primary, setPrimary] = useState<"father" | "mother">("father")

  const classSections = (sections.data ?? [])
    .filter((s) => s.classId === classId)
    .sort((a, b) => a.name.localeCompare(b.name))
  const phoneOk = (p: string) => !p.trim() || normalizePhone(p) !== null
  const parentOk =
    (father.name.trim() && phoneOk(father.phone)) ||
    (mother.name.trim() && phoneOk(mother.phone))
  const valid =
    v.firstName.trim().length > 0 &&
    v.lastName.trim().length > 0 &&
    (!admitting ||
      (Boolean(classId) &&
        Boolean(sectionId) &&
        Boolean(parentOk) &&
        phoneOk(father.phone) &&
        phoneOk(mother.phone)))

  const save = useMutation({
    mutationFn: async () => {
      if (id) {
        await updateStudent(id, toInput(v))
        return id
      }
      // No roll typed: the next number after the section's highest.
      let rollNo = roll.trim()
      if (!rollNo) {
        const inSection = await apiFetchPage<StudentRow>("/students", {
          query: { sectionId, limit: 100 },
        })
        const highest = Math.max(
          0,
          ...inSection.items.map((x) => Number(x.placement?.rollNo) || 0)
        )
        rollNo = String(highest + 1)
      }
      const student = await createStudent({ ...toInput(v), classId })
      await enrollStudent({
        studentId: student.id,
        academicYearId: session.data!.id,
        classId,
        sectionId,
        rollNo,
      })
      for (const [relation, p] of [
        ["father", father],
        ["mother", mother],
      ] as const) {
        if (!p.name.trim()) continue
        const phone = p.phone.trim() ? normalizePhone(p.phone) : null
        // A sibling's parent is already in the school: link, don't duplicate.
        const existing = phone ? await findGuardianByPhone(phone) : null
        await attachGuardian(student.id, {
          ...(existing
            ? { guardianId: existing.id }
            : {
                createGuardian: {
                  name: p.name.trim(),
                  ...(phone ? { phone } : {}),
                },
              }),
          relation,
          isPrimary: primary === relation,
        })
      }
      return student.id
    },
    onSuccess: async (studentId) => {
      toast.add({
        title: admitting
          ? t("admitted", { name: `${v.firstName} ${v.lastName}` })
          : t("updated"),
        type: "success",
      })
      await queryClient.invalidateQueries({ queryKey: ["students"] })
      router.push(`/dashboard/students/${studentId}`)
    },
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })

  return (
    <form
      className="flex max-w-3xl flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid && !save.isPending) save.mutate()
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("studentTitle")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field id="first" label={t("firstName")}>
            <Input
              id="first"
              required
              value={v.firstName}
              maxLength={60}
              onChange={(e) => set("firstName", e.target.value)}
            />
          </Field>
          <Field id="last" label={t("lastName")}>
            <Input
              id="last"
              required
              value={v.lastName}
              maxLength={60}
              onChange={(e) => set("lastName", e.target.value)}
            />
          </Field>
          <Field id="gender" label={t("gender")}>
            <NativeSelect
              id="gender"
              className="w-full"
              value={v.gender}
              onChange={(e) =>
                set("gender", e.target.value as Values["gender"])
              }
            >
              <NativeSelectOption value="">{t("choose")}</NativeSelectOption>
              <NativeSelectOption value="male">
                {t("genders.male")}
              </NativeSelectOption>
              <NativeSelectOption value="female">
                {t("genders.female")}
              </NativeSelectOption>
              <NativeSelectOption value="other">
                {t("genders.other")}
              </NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field id="dob" label={t("dob")}>
            <Input
              id="dob"
              type="date"
              value={v.dob}
              onChange={(e) => set("dob", e.target.value)}
            />
          </Field>
          <Field id="religion" label={t("religion")}>
            <Input
              id="religion"
              value={v.religion}
              maxLength={40}
              onChange={(e) => set("religion", e.target.value)}
            />
          </Field>
          <Field id="blood" label={t("bloodGroup")}>
            <NativeSelect
              id="blood"
              className="w-full"
              value={v.bloodGroup}
              onChange={(e) => set("bloodGroup", e.target.value)}
            >
              <NativeSelectOption value="">{t("choose")}</NativeSelectOption>
              {BLOOD_GROUPS.map((b) => (
                <NativeSelectOption key={b} value={b}>
                  {b}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="admitted" label={t("admissionDate")}>
            <Input
              id="admitted"
              type="date"
              value={v.admissionDate}
              onChange={(e) => set("admissionDate", e.target.value)}
            />
          </Field>
          <Field id="previous" label={t("previousSchool")}>
            <Input
              id="previous"
              value={v.previousSchool}
              maxLength={120}
              onChange={(e) => set("previousSchool", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      {admitting && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{t("classTitle")}</h2>
              </CardTitle>
              <CardDescription>
                {session.data
                  ? t("classHint", { session: session.data.name })
                  : t("noSession")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <Field id="class" label={t("class")}>
                <NativeSelect
                  id="class"
                  className="w-full"
                  value={classId}
                  onChange={(e) => {
                    setClassId(e.target.value)
                    setSectionId("")
                  }}
                >
                  <NativeSelectOption value="" disabled>
                    {t("choose")}
                  </NativeSelectOption>
                  {(classes.data ?? [])
                    .slice()
                    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
                    .map((c) => (
                      <NativeSelectOption key={c.id} value={c.id}>
                        {c.name}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
              </Field>
              <Field id="section" label={t("section")}>
                <NativeSelect
                  id="section"
                  className="w-full"
                  value={sectionId}
                  disabled={!classId}
                  onChange={(e) => setSectionId(e.target.value)}
                >
                  <NativeSelectOption value="" disabled>
                    {t("choose")}
                  </NativeSelectOption>
                  {classSections.map((s) => (
                    <NativeSelectOption key={s.id} value={s.id}>
                      {s.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="roll" label={t("roll")} hint={t("rollHint")}>
                <Input
                  id="roll"
                  inputMode="numeric"
                  value={roll}
                  maxLength={10}
                  onChange={(e) => setRoll(e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{t("parentsTitle")}</h2>
              </CardTitle>
              <CardDescription>{t("parentsHint")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {(
                [
                  ["father", father, setFather],
                  ["mother", mother, setMother],
                ] as const
              ).map(([rel, p, setP]) => (
                <fieldset
                  key={rel}
                  className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                >
                  <Field id={`${rel}-name`} label={t(`${rel}Name`)}>
                    <Input
                      id={`${rel}-name`}
                      value={p.name}
                      maxLength={80}
                      onChange={(e) => setP({ ...p, name: e.target.value })}
                    />
                  </Field>
                  <Field
                    id={`${rel}-phone`}
                    label={t("phone")}
                    error={phoneOk(p.phone) ? undefined : t("phoneInvalid")}
                  >
                    <Input
                      id={`${rel}-phone`}
                      type="tel"
                      inputMode="tel"
                      value={p.phone}
                      placeholder={t("phonePlaceholder")}
                      aria-invalid={!phoneOk(p.phone)}
                      onChange={(e) => setP({ ...p, phone: e.target.value })}
                    />
                  </Field>
                  <Label className="flex h-10 items-center gap-2 font-normal">
                    <input
                      type="radio"
                      name="primary"
                      checked={primary === rel}
                      onChange={() => setPrimary(rel)}
                    />
                    {t("mainContact")}
                  </Label>
                </fieldset>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={!valid || save.isPending}>
          {save.isPending ? t("saving") : admitting ? t("admit") : t("save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.back()}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  )
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}
