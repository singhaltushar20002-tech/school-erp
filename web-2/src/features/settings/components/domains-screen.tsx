"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CopyIcon, GlobeIcon, StarIcon, Trash2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Skeleton } from "~/components/ui/skeleton"
import { toast } from "~/components/ui/toast"
import { Can } from "~/features/access/can"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { apiFetch } from "~/lib/api/client"
import { isApiError } from "~/lib/api/errors"

interface Domain {
  id: string
  hostname: string
  isPrimary: boolean
  status: "pending" | "verified" | "active" | "inactive"
  tlsStatus: string
  verifiedAt: string | null
  lastCheckedAt: string | null
  dnsRecords: { type: string; name: string; value: string }[]
}

const KEY = ["settings", "domains"] as const

/**
 * `/dashboard/settings/domains`: the school's own web address (such as
 * erp.myschool.in). Add it, create the two DNS records shown, then verify.
 */
export function DomainsScreen() {
  const t = useTranslations("domainsScreen")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const domains = useQuery({
    queryKey: KEY,
    queryFn: ({ signal }) => apiFetch<Domain[]>("/domains", { signal }),
  })
  const [hostname, setHostname] = useState("")
  const done = async (title: string) => {
    toast.add({ title, type: "success" })
    await queryClient.invalidateQueries({ queryKey: KEY })
  }
  const fail = (error: unknown) =>
    toast.add({
      title: t("failed"),
      description: isApiError(error) ? error.message : undefined,
      type: "error",
    })
  const add = useMutation({
    mutationFn: () =>
      apiFetch<Domain>("/domains", {
        method: "POST",
        body: { hostname: hostname.trim().toLowerCase() },
      }),
    onSuccess: async () => {
      setHostname("")
      await done(t("added"))
    },
    onError: fail,
  })
  const act = useMutation({
    mutationFn: (v: { id: string; op: "verify" | "primary" | "remove" }) =>
      v.op === "remove"
        ? apiFetch<unknown>(`/domains/${v.id}`, { method: "DELETE" })
        : apiFetch<unknown>(`/domains/${v.id}/${v.op}`, {
            method: "POST",
            body: {},
          }),
    onSuccess: (_, v) => done(t(`done.${v.op}`)),
    onError: fail,
  })
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.add({ title: t("copied"), type: "success" })
    } catch {
      // Clipboard blocked: the value is on screen to copy by hand.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Can permission="domains:manage">
        <form
          className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (hostname.trim()) add.mutate()
          }}
        >
          <div className="flex min-w-64 flex-1 flex-col gap-1.5">
            <Label htmlFor="dom-host">{t("hostname")}</Label>
            <Input
              id="dom-host"
              placeholder={t("hostnamePlaceholder")}
              maxLength={253}
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={!hostname.trim() || add.isPending}>
            {t("add")}
          </Button>
        </form>
      </Can>

      {domains.isPending ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : (domains.data ?? []).length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GlobeIcon />
            </EmptyMedia>
            <EmptyTitle>{t("empty")}</EmptyTitle>
            <EmptyDescription>{t("emptyBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {(domains.data ?? []).map((d) => (
            <li
              key={d.id}
              className="flex flex-col gap-3 rounded-xl border bg-card p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-medium">{d.hostname}</span>
                <Badge
                  variant={
                    d.status === "active"
                      ? "default"
                      : d.status === "inactive"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {t(`statuses.${d.status}`)}
                </Badge>
                {d.isPrimary && (
                  <Badge variant="outline">
                    <StarIcon /> {t("primary")}
                  </Badge>
                )}
                <Can permission="domains:manage">
                  <span className="ms-auto flex flex-wrap gap-2">
                    {d.status !== "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={act.isPending}
                        onClick={() => act.mutate({ id: d.id, op: "verify" })}
                      >
                        {t("verify")}
                      </Button>
                    )}
                    {!d.isPrimary && d.status === "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={act.isPending}
                        onClick={() => act.mutate({ id: d.id, op: "primary" })}
                      >
                        {t("makePrimary")}
                      </Button>
                    )}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t("remove", { host: d.hostname })}
                      disabled={act.isPending}
                      onClick={() => act.mutate({ id: d.id, op: "remove" })}
                    >
                      <Trash2Icon />
                    </Button>
                  </span>
                </Can>
              </div>
              {d.status !== "active" && (
                <div className="flex flex-col gap-2 text-sm">
                  <p className="text-muted-foreground">{t("dnsHint")}</p>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted text-left">
                        <tr>
                          <th className="px-3 py-1.5 font-medium">
                            {t("type")}
                          </th>
                          <th className="px-3 py-1.5 font-medium">
                            {t("name")}
                          </th>
                          <th className="px-3 py-1.5 font-medium">
                            {t("value")}
                          </th>
                          <th />
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {d.dnsRecords.map((r) => (
                          <tr key={r.type} className="border-t">
                            <td className="px-3 py-1.5">{r.type}</td>
                            <td className="px-3 py-1.5 break-all">{r.name}</td>
                            <td className="px-3 py-1.5 break-all">{r.value}</td>
                            <td className="px-1">
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                aria-label={t("copy")}
                                onClick={() => copy(r.value)}
                              >
                                <CopyIcon />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {d.lastCheckedAt && (
                    <p className="text-xs text-muted-foreground">
                      {t("lastChecked", { when: f.dateTime(d.lastCheckedAt) })}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
