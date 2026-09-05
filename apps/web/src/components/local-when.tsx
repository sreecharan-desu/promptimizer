"use client";

import { useEffect, useState } from "react";

/** Format timestamps in the viewer's local timezone (SSR stores UTC). */
export function LocalWhen({ iso, className }: { iso: string; className?: string }) {
  const [label, setLabel] = useState(() =>
    new Date(iso).toLocaleString("en-IN", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    }),
  );

  useEffect(() => {
    setLabel(
      new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    );
  }, [iso]);

  return (
    <time dateTime={iso} className={className} title={new Date(iso).toISOString()}>
      {label}
    </time>
  );
}
