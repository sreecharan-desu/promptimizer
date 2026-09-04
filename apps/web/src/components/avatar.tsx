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
  const initials =
    (name || email || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const className = size > 36 ? "size-10 text-sm" : "size-8 text-[11px]";

  if (src) {
    return (
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        className={`${className} shrink-0 rounded-full object-cover`}
        width={size}
        height={size}
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
