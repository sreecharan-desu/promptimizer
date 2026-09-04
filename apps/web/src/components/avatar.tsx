"use client";

import { useState } from "react";

export function UserAvatar({
  name,
  email,
  src,
  size = 32,
}: {
  name?: string;
  email?: string;
  src?: string | null;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const initials =
    (name || email || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const className = size > 36 ? "size-10 text-sm" : "size-8 text-[11px]";

  if (src && !broken) {
    return (
      // Google profile photos need a plain img + no-referrer.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        loading="eager"
        decoding="async"
        className={`${className} shrink-0 rounded-full bg-primary/10 object-cover`}
        width={size}
        height={size}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <span
      className={`inline-flex ${className} shrink-0 items-center justify-center rounded-full bg-primary/15 font-medium text-primary`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
