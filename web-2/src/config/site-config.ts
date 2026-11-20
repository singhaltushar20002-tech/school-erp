import { appConfig } from "./app-config"
import { BRAND } from "./brand-config"

/**
 * What the site says about itself: titles, description, keywords and its
 * address, used for page metadata (root layout) and the marketing pages.
 * The name follows the brand (`config/brand-config.ts`).
 */
export const siteConfig = {
  name: BRAND.name,
  /** Home page title; other pages use `titleTemplate`. */
  title: `${BRAND.name}, school management software`,
  titleTemplate: `%s | ${BRAND.name}`,
  description:
    "Attendance, results, fees and notices on one mobile-first platform, in English and Hindi.",
  /** One line under the logo in the marketing footer. */
  tagline: "School management in English and Hindi.",
  keywords: [
    "school management software",
    "school ERP",
    "attendance",
    "exam results",
    "school fees",
    "student portal",
    "guardian app",
    "Hindi",
    "स्कूल प्रबंधन सॉफ़्टवेयर",
  ],
  /**
   * The marketing site's address (`NEXT_PUBLIC_SITE_URL`), the base of
   * absolute metadata URLs. School hosts are `<slug>.<rootDomain>`.
   */
  siteUrl: appConfig.appUrl,
  /** Open Graph locales: English first, Hindi as the alternate. */
  locale: "en_BD",
  alternateLocale: ["hi_IN"],
  contactEmail: BRAND.contactEmail,
} as const
