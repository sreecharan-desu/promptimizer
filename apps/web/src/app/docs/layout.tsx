import { DocsMobileNav, DocsSidebar } from "@/components/docs/sidebar";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-7xl gap-10 px-4 py-10 sm:px-6">
      <DocsSidebar />
      <div className="min-w-0 flex-1">
        <DocsMobileNav />
        {children}
      </div>
    </div>
  );
}
