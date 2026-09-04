export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <rect width="36" height="36" rx="10" className="fill-primary" />
      <path
        d="M9 23.5c4.2-9 7.4-13 13.8-13"
        className="stroke-background"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="24.5" cy="10.2" r="2.1" className="fill-accent" />
      <circle cx="11.2" cy="24.2" r="2.1" className="fill-background" />
    </svg>
  );
}
