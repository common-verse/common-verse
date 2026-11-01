export type NoticeTone = "success" | "error";

export interface Notice {
  tone: NoticeTone;
  text: string;
  link?: { href: string; label: string };
}

let show: ((notice: Notice) => void) | undefined;

/**
 * Shows a page notification from any island; the header renders it.
 * Calls before the notification area has mounted are dropped.
 */
export const notify = (notice: Notice) => show?.(notice);

/** Only the mounted notification area listens, so server renders never share state. */
export function listen(handler: (notice: Notice) => void) {
  show = handler;
  return () => {
    if (show === handler) show = undefined;
  };
}
