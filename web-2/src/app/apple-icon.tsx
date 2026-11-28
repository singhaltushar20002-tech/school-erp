import { ImageResponse } from "next/og"

import { SchoolErpGlyph } from "~/components/brand/school-erp-mark"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

// The product's mark (as in app/icon.svg) in the light theme's
// colors, full-bleed: iOS applies its own corner mask.
export default function AppleIcon() {
  return new ImageResponse(
    <svg width="180" height="180" viewBox="0 0 32 32">
      <rect width="32" height="32" fill="#1B503A" />
      {
        // Called, not rendered: ImageResponse only takes plain SVG elements.
        SchoolErpGlyph({ stroke: "#FAFAF7" })
      }
    </svg>,
    size
  )
}
