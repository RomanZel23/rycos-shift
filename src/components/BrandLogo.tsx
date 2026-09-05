"use client";

import React from "react";
import { fullLogoSvg, markSvg, LogoVariant } from "@/lib/brand";

/**
 * Prawdziwe logo SolutionsBay. Zastępuje romb z czterech trójkątów, który był
 * rysowany ręcznie osobno w nagłówku, na ekranie logowania i w PDF-ach.
 *
 * `variant="dark"` do ciemnych teł portalu — granatowe i czarne elementy znaku
 * zamieniają się wtedy na białe, bo na granatowym nagłówku po prostu znikają.
 *
 * Wstawiamy przez dangerouslySetInnerHTML, bo kształty pochodzą z jednego
 * miejsca (src/lib/brand.ts) i są używane także po stronie serwera, przy
 * składaniu HTML-a dla Chromium generującego PDF. Treść jest stała i nie
 * pochodzi z żadnego wejścia użytkownika.
 */
interface BrandLogoProps {
  /** "mark" — sam sygnet, "full" — sygnet z napisem SolutionsBay. */
  kind?: "mark" | "full";
  variant?: LogoVariant;
  className?: string;
  /** Szerokość w pikselach; wysokość dobiera się z proporcji znaku. */
  width?: number;
}

export function BrandLogo({
  kind = "mark",
  variant = "light",
  className = "",
  width,
}: BrandLogoProps) {
  const svg =
    kind === "full"
      ? fullLogoSvg(variant, 'width="100%" height="100%"')
      : markSvg(variant, 'width="100%" height="100%"');

  return (
    <span
      className={`inline-block leading-none ${className}`}
      style={width ? { width } : undefined}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
