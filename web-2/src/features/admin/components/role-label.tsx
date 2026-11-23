"use client"

import { useRoleLabel as useShellRoleLabel } from "~/features/shell/role-label"

/** A role's display name: system roles translated, custom ones as typed. */
export function useRoleLabel() {
  const label = useShellRoleLabel()
  return (role: { name: string; isSystem?: boolean }) =>
    role.isSystem === false ? role.name : label(role.name)
}
