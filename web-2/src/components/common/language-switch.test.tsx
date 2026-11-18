import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

import en from "../../../messages/en.json"
import hi from "../../../messages/hi.json"

import { LanguageSwitch } from "./language-switch"

const refresh = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }))

const catalogs = { en, hi }

function renderIn(locale: keyof typeof catalogs) {
  return render(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]}>
      <LanguageSwitch />
    </NextIntlClientProvider>
  )
}

afterEach(() => {
  document.cookie = "locale=; path=/; max-age=0"
  refresh.mockClear()
})

describe("LanguageSwitch", () => {
  it("shows the current language and offers both", () => {
    renderIn("en")
    const select = screen.getByRole("combobox", {
      name: "Language",
    }) as HTMLSelectElement
    expect(select.value).toBe("en")
    expect([...select.options].map((o) => o.textContent)).toEqual([
      "English",
      "हिन्दी",
    ])
    expect(select.selectedOptions[0]?.textContent).toBe("English")
  })

  it("switches to Hindi", async () => {
    renderIn("en")
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Language" }),
      "hi"
    )

    expect(document.cookie).toContain("locale=hi")
    expect(refresh).toHaveBeenCalledOnce()
  })

  it("labels itself in the page's language", () => {
    renderIn("hi")
    expect(screen.getByRole("combobox", { name: "भाषा" })).toBeTruthy()
  })
})
