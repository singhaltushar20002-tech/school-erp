"use client"

import { LogOutIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { createContext, useContext, useState } from "react"

import { BrandMark } from "~/components/brand/brand-mark"
import { LanguageSwitch } from "~/components/common/language-switch"
import { ThemeToggle } from "~/components/common/theme-toggle"
import { InitialsAvatar } from "~/components/common/initials-avatar"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { BRAND } from "~/config/brand-config"
import { signOut } from "~/features/auth/sign-out"
import type { SessionUser } from "~/lib/auth/types"
import { cn } from "~/lib/utils"

const ConsoleUser = createContext<SessionUser | null>(null)

/** The signed-in platform user, inside the console. */
export function useConsoleUser() {
  return useContext(ConsoleUser)
}

/** Whether the console user's role grants `permission`. */
export function useConsoleCan() {
  const user = useConsoleUser()
  return (permission: string) => Boolean(user?.permissions.includes(permission))
}

/** Console sections, each shown only with the permission behind it. */
const SECTIONS = [
  { id: "overview", href: "/", permission: "console:access" },
  { id: "schools", href: "/schools", permission: "organizations:read" },
  { id: "plans", href: "/plans", permission: "plans:read" },
  { id: "staff", href: "/staff", permission: "platform_users:read" },
  { id: "audit", href: "/audit", permission: "audit:read" },
] as const

/**
 * The platform console around every admin page: the brand, the section
 * tabs (schools, plans, staff, audit), language, theme and account menu.
 */
export function AdminShell({
  user,
  children,
}: {
  user: SessionUser
  children: React.ReactNode
}) {
  const t = useTranslations("admin")
  const tn = useTranslations("admin.nav")
  const pathname = usePathname()
  const sections = SECTIONS.filter((s) =>
    user.permissions.includes(s.permission)
  )
  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)
  return (
    <ConsoleUser.Provider value={user}>
      <div className="flex min-h-svh flex-col bg-muted/40">
        <header className="sticky top-0 z-10 border-b bg-background">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5">
            <BrandMark className="size-7" />
            <span className="min-w-0 flex-1 truncate font-semibold">
              {t("title", { brand: BRAND.name })}
            </span>
            <LanguageSwitch />
            <ThemeToggle />
            <AdminMenu user={user} />
          </div>
          <nav
            aria-label={tn("label")}
            className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4"
          >
            {sections.map((s) => (
              <Link
                key={s.id}
                href={s.href}
                aria-current={active(s.href) ? "page" : undefined}
                className={cn(
                  "border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground",
                  active(s.href) && "border-primary font-medium text-foreground"
                )}
              >
                {tn(s.id)}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
      </div>
    </ConsoleUser.Provider>
  )
}

/** The console roles with a label (`admin.menu.roles`). */
const PLATFORM_ROLES = ["super_admin", "admin", "support", "developer"] as const

function AdminMenu({ user }: { user: SessionUser }) {
  const t = useTranslations("admin.menu")
  const [signingOut, setSigningOut] = useState(false)
  const name = user.name ?? user.email ?? user.phone ?? ""
  const contact = user.email ?? user.phone
  const role = PLATFORM_ROLES.find((r) => r === user.platformRole)

  function leave(everywhere: boolean) {
    setSigningOut(true)
    void signOut({ everywhere })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label={t("label", { name })}
          />
        }
      >
        <InitialsAvatar name={name} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-1.5 text-foreground">
            <span className="truncate text-sm font-medium">{name}</span>
            {contact && contact !== name && (
              <span className="truncate text-xs font-normal text-muted-foreground">
                {contact}
              </span>
            )}
            {role && (
              <span className="truncate text-xs font-normal text-muted-foreground">
                {t("role", { role: t(`roles.${role}`) })}
              </span>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={signingOut} onClick={() => leave(false)}>
            <LogOutIcon />
            {t("signOut")}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={signingOut}
            onClick={() => leave(true)}
          >
            <LogOutIcon />
            {t("signOutEverywhere")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
