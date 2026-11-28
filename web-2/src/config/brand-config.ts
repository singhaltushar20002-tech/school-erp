import { appConfig } from "./app-config"

/**
 * The product's brand: its name, the company behind it, the contact
 * address and the prefix of its cookies. The product name isn't final yet:
 * "School ERP" stands in until it is. To rebrand, change these values and
 * swap `app/icon.svg` and `components/brand/school-erp-icon.svg` (the
 * favicon is a static file; `BrandMark` and the Apple icon follow the mark
 * in `components/brand/school-erp-mark.tsx`).
 *
 * Changing `cookiePrefix` renames the session cookies, which signs
 * everyone out once.
 */
export const BRAND = {
  id: "school-erp",
  name: "School ERP",
  /** The company that makes and supports the product. */
  company: "Fast IO",
  /** No domain of its own yet: the deployment's root domain. */
  domain: null as string | null,
  /** Sales and support. */
  contactEmail: "business@fastio.in",
  /** Session cookies are `<prefix>_session` and `<prefix>_admin`. */
  cookiePrefix: "school_erp",
} as const

export type Brand = typeof BRAND

/** The domain in example school addresses (`yourschool.<domain>`). */
export const brandDomain: string = BRAND.domain ?? appConfig.rootDomain
