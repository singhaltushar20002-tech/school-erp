import { apiFetch } from "~/lib/api/client"

// Excel imports (backend `imports`): upload → a validation job → a
// row-by-row preview → commit (all rows, or the valid ones only).

export type ImportType = "students" | "staff" | "opening_balances"
export type ImportStatus =
  "uploaded" | "validating" | "validated" | "committing" | "done" | "failed"

export interface RowError {
  row: number
  column: string
  code: string
  message: string
}

export interface ImportBatch {
  id: string
  type: ImportType | "marks"
  status: ImportStatus
  totals: { rows: number; valid: number; invalid: number } | null
  errors: RowError[]
  failure: string | null
}

/** The template as the BFF serves it (an .xlsx download). */
export const templateUrl = (type: ImportType) =>
  `/api/imports/templates/${type}`

export const startImport = (type: ImportType, file: File) => {
  const form = new FormData()
  form.append("type", type)
  form.append("mode", "all_or_nothing")
  form.append("file", file)
  return apiFetch<{ import: ImportBatch }>("/imports", {
    method: "POST",
    body: form,
  })
}

export const getImport = (id: string) => apiFetch<ImportBatch>(`/imports/${id}`)

export const commitImport = (
  id: string,
  mode: "all_or_nothing" | "valid_only"
) =>
  apiFetch<unknown>(`/imports/${id}/commit`, { method: "POST", body: { mode } })

/** Polls the batch until it leaves the given in-progress statuses. */
export async function waitForImport(
  id: string,
  busy: ImportStatus[]
): Promise<ImportBatch> {
  for (let i = 0; i < 300; i++) {
    const batch = await getImport(id)
    if (!busy.includes(batch.status)) return batch
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error("The import is taking too long")
}

export interface ImportColumns {
  expected: { header: string; required: boolean }[]
  fileHeaders: string[]
  columnMap: Record<string, string>
}

export const getImportColumns = (id: string) =>
  apiFetch<ImportColumns>(`/imports/${id}/columns`)

/** Saves how the file's columns match the template; checks the file again. */
export const remapImport = (id: string, columnMap: Record<string, string>) =>
  apiFetch<unknown>(`/imports/${id}/columns`, {
    method: "POST",
    body: { columnMap },
  })
