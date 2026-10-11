"use client";

import Link from "next/link";
import { useState } from "react";
import type { ComponentProps } from "react";

/**
 * Link that fully prefetches its (dynamic) route as soon as the user shows
 * intent — hover, keyboard focus or touch — instead of prefetching every link
 * in the viewport. By the time the click lands the page data is usually
 * already in the client cache, so opening a note feels instant without
 * warming dozens of detail pages up front.
 */
export function IntentLink({
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [intent, setIntent] = useState(false);

  return (
    <Link
      {...props}
      prefetch={intent ? true : false}
      onMouseEnter={(e) => {
        setIntent(true);
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        setIntent(true);
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        setIntent(true);
        onTouchStart?.(e);
      }}
    />
  );
}
