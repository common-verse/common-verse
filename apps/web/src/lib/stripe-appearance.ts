import type { Appearance } from "@stripe/stripe-js";

// Stripe's iframes cannot read our CSS variables or mix colours, so the tokens are resolved
// to plain sRGB in the page and passed on. Browser-only.

let context: CanvasRenderingContext2D | null | undefined;

/** Any CSS colour (light-dark, color-mix, oklch) as rgb()/rgba(), which Stripe understands. */
function srgb(color: string) {
  context ??= document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true });
  if (!context) return color;
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return a === 255
    ? `rgb(${r}, ${g}, ${b})`
    : `rgba(${r}, ${g}, ${b}, ${(a! / 255).toFixed(2)})`;
}

/** Payment and Express Checkout Element appearance from the current theme's tokens. */
export function tokenAppearance(host: HTMLElement): Appearance {
  const probe = document.createElement("span");
  probe.hidden = true;
  host.append(probe);
  const token = (name: string) => {
    probe.style.color = `var(--${name})`;
    return srgb(getComputedStyle(probe).color);
  };
  const colors = {
    background: token("background"),
    foreground: token("foreground"),
    muted: token("muted-foreground"),
    input: token("input"),
    ring: token("ring"),
    error: token("error"),
    errorText: token("error-text"),
  };
  const { fontFamily, fontSize } = getComputedStyle(host);
  probe.remove();
  return {
    theme: "stripe",
    variables: {
      colorPrimary: colors.foreground,
      colorBackground: colors.background,
      colorText: colors.foreground,
      colorTextSecondary: colors.muted,
      colorTextPlaceholder: colors.muted,
      colorDanger: colors.errorText,
      fontFamily,
      fontSizeBase: fontSize,
      // The control radius without squircles; the iframes cannot use corner-shape.
      borderRadius: "12px",
    },
    rules: {
      ".Input, .AccordionItem": {
        borderColor: colors.input,
        boxShadow: "none",
      },
      ".Input:focus": {
        borderColor: colors.ring,
        boxShadow: `0 0 0 1px ${colors.ring}`,
      },
      ".Input--invalid": {
        borderColor: colors.error,
        boxShadow: `0 0 0 1px ${colors.error}`,
      },
      ".Label": { fontWeight: "600" },
    },
  };
}
