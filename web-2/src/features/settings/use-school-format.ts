"use client"

import { useQuery } from "@tanstack/react-query"
import { useLocale } from "next-intl"

import { displaySettingsQuery } from "~/features/settings/api"
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatMonth,
  formatNumber,
  type DateFormat,
  type MoneyOptions,
  type Numerals,
} from "~/lib/format"

/**
 * `lib/format.ts` bound to the viewer and the school: Bangla digits when
 * the viewer reads Bangla, the school's time zone and date format from
 * `GET /settings/display` (hydrated by the dashboard layout).
 */
export function useSchoolFormat() {
  const locale = useLocale()
  const { data } = useQuery(displaySettingsQuery())
  const numerals: Numerals = "en"
  const language = locale === "hi" ? "hi" : "en"
  const timeZone = data?.locale.timeZone
  const dateFormat: DateFormat | undefined = data?.locale.dateFormat
  const currency = data?.locale.currency

  return {
    numerals,
    /** ISO 4217 code of the school's money (INR by default). */
    currency: currency ?? "INR",
    money: (minor: number, options: MoneyOptions = {}) =>
      formatMoney(minor, { numerals, currency, ...options }),
    /** Whole rupees, no `.00`: for tiles. */
    moneyShort: (minor: number) =>
      formatMoney(minor, { numerals, currency, trimZeroFraction: true }),
    number: (value: number) => formatNumber(value, { numerals }),
    /** A year or code: digits only, no grouping. */
    plain: (value: number) =>
      formatNumber(value, { numerals, grouping: "none" }),
    percent: (value: number) => `${formatNumber(value, { numerals })}%`,
    /** A billing period (`2026-11`): `Nov 2026`. */
    month: (period: string) => formatMonth(period, { numerals, language }),
    /** `D MMM YYYY` for headings and lists (month names read better). */
    date: (value: string) =>
      formatDate(value, { timeZone, format: "D MMM YYYY", numerals, language }),
    dateTime: (value: string) =>
      formatDateTime(value, {
        timeZone,
        format: dateFormat,
        numerals,
        language,
      }),
  }
}
