"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { CodeBlock } from "@/components/docs/code-block";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-4 mb-2 text-base font-semibold tracking-tight text-primary first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 mb-2 text-[15px] font-semibold tracking-tight text-primary first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1.5 text-sm font-semibold text-primary first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-3 mb-1 text-sm font-medium text-primary first:mt-0">{children}</h4>
  ),
  p: ({ children }) => <p className="my-2.5 text-sm leading-relaxed text-primary first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-2.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-primary marker:text-secondary">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2.5 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-primary marker:text-secondary">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
  em: ({ children }) => <em className="italic text-primary/90">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-primary/15 pl-3 text-sm leading-relaxed text-secondary">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-primary/10" />,
  code: ({ className, children }) => {
    const isBlock = Boolean(className?.includes("language-")) || String(children).includes("\n");
    if (isBlock) {
      return <code className="font-mono text-[12.5px] leading-relaxed text-primary">{children}</code>;
    }
    return (
      <code className="rounded-md bg-codeblock px-1.5 py-0.5 font-mono text-[12.5px] text-primary">
        {children}
      </code>
    );
  },
  pre: ({ children }: any) => {
    const codeElement = children as any;
    if (codeElement?.props && typeof codeElement.props.children === "string") {
      const className = codeElement.props.className || "";
      const match = /language-([a-zA-Z0-9_\-]+)/.exec(className);
      const label = match ? match[1] : undefined;
      return <CodeBlock code={codeElement.props.children} label={label} className="my-3" />;
    }
    return (
      <pre className="my-3 overflow-x-auto rounded-lg border border-primary/[0.06] bg-codeblock px-3.5 py-3 font-mono text-[12.5px] leading-relaxed text-primary">
        {children}
      </pre>
    );
  },
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-primary/[0.06]">
      <table className="w-full border-collapse text-left text-[13px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-codeblock/80 text-secondary">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-primary/[0.08] px-3 py-2 font-medium">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-primary/[0.05] px-3 py-2 text-primary align-top">{children}</td>
  ),
  tr: ({ children }) => <tr className="last:[&>td]:border-b-0">{children}</tr>,
};

export function MarkdownContent({ children, className = "" }: { children: string; className?: string }) {
  if (!children.trim()) return null;
  return (
    <div className={`markdown-content min-w-0 break-words ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
