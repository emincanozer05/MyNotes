"use client";

import type { ReactNode } from "react";

/**
 * A form submit button that asks for confirmation before submitting.
 * Works inside server-component `<form action={serverAction}>` because the
 * button itself is a client island. Declining cancels the submit.
 */
export function ConfirmSubmit({
  message = "Emin misiniz? Bu işlem geri alınamaz.",
  className,
  title,
  ariaLabel,
  children,
}: {
  message?: string;
  className?: string;
  title?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      title={title}
      aria-label={ariaLabel}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
