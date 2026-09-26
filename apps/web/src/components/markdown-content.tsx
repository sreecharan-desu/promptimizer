"use client";

import React from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const REASONING_TAG = "thought|think|thinking|reasoning|analysis";

/** Hide model reasoning and keep partial markdown from swallowing the answer. */
export function prepareAnswerMarkdown(raw: string, streaming = false): string {
  let text = raw.replace(/\r\n/g, "\n");
  text = text.replace(new RegExp(`<(${REASONING_TAG})\\b[^>]*>[\\s\\S]*?<\\/\\1>`, "gi"), "");
  text = text.replace(new RegExp(`<(${REASONING_TAG})\\b[^>]*>[\\s\\S]*$`, "i"), "");
  text = text.replace(new RegExp(`<\\/(${REASONING_TAG})>`, "gi"), "");
  text = text.replace(/\n{3,}/g, "\n\n");

  text = repairFences(text, streaming);
  text = unwrapProseFences(text);

  if (streaming) {
    const bold = text.match(/\*\*/g);
    if (bold && bold.length % 2 === 1) text += "**";
  }

  return text.trim();
}

function looksLikeProse(body: string): boolean {
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return true;
  let prose = 0;
  for (const line of lines) {
    if (/^[-*+]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) prose += 1;
    else if (/[{};]|=>|\b(function|def|class|import|const|let|return|SELECT)\b/.test(line)) continue;
    else if (/[A-Za-z]{3,}/.test(line)) prose += 1;
  }
  return prose / lines.length >= 0.55;
}

/** Pair fences without letting a leftover closer swallow the next real block. */
function repairFences(text: string, streaming: boolean): string {
  const marker = /```[^\n]*/g;
  let markers = [...text.matchAll(marker)];
  if (!markers.length) return text;

  // A reasoning tag often leaves its closing fence behind. That stray ```
  // would pair with the next real opener (```python) and hide the answer.
  if (markers.length >= 2 && !markers[0][0].slice(3).trim() && markers[1][0].slice(3).trim()) {
    const stray = markers[0];
    text = text.slice(0, stray.index) + text.slice(stray.index! + stray[0].length);
    markers = [...text.matchAll(marker)];
  }

  if (markers.length % 2 === 1) {
    const last = markers[markers.length - 1];
    if (streaming) {
      text += "\n```";
    } else if (last.index != null) {
      text = text.slice(0, last.index) + text.slice(last.index + last[0].length);
    }
  }
  return text;
}

function unwrapProseFences(text: string): string {
  return text.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (full, lang: string, body: string) => {
    const label = lang.trim();
    if (label && !/^(text|txt|markdown|md)$/i.test(label)) return full;
    if (!looksLikeProse(body)) return full;
    return `\n${body.trim()}\n`;
  });
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-3 mb-1.5 text-sm font-semibold tracking-tight text-primary first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3 mb-1.5 text-sm font-semibold tracking-tight text-primary first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1 text-sm font-semibold text-primary first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-2.5 mb-1 text-sm font-medium text-primary first:mt-0">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="my-2.5 max-w-full text-sm leading-relaxed break-words text-primary [overflow-wrap:anywhere] first:mt-0 last:mb-0">
      {children}
    </p>
  ),
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
  li: ({ children }) => <li className="min-w-0 break-words pl-0.5 [overflow-wrap:anywhere]">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
  em: ({ children }) => <em className="italic text-primary/90">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="break-all font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2.5 max-w-full border-l-2 border-primary/15 pl-3 text-sm leading-relaxed text-secondary">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-primary/10" />,
  code: ({ className, children }) => {
    const isBlock = Boolean(className?.includes("language-")) || String(children).includes("\n");
    if (isBlock) {
      return <code className="font-mono text-sm leading-relaxed text-primary">{children}</code>;
    }
    return (
      <code className="rounded-md bg-codeblock px-1.5 py-0.5 font-mono text-[13px] text-primary">
        {children}
      </code>
    );
  },
  pre: ({ children }) => {
    const codeElement = children as { props?: { children?: unknown; className?: string } };
    const raw = codeElement?.props?.children;
    const code = typeof raw === "string" ? raw.replace(/\n$/, "") : "";
    const className = codeElement?.props?.className || "";
    const lang = /language-([a-zA-Z0-9_-]+)/.exec(className)?.[1];
    if (code && (!lang || /^(text|txt|markdown|md)$/i.test(lang)) && looksLikeProse(code)) {
      return <MarkdownContent>{code}</MarkdownContent>;
    }
    return (
      <pre className="my-2.5 max-w-full overflow-x-auto rounded-lg border border-primary/[0.06] bg-codeblock px-3 py-2.5 font-mono text-sm leading-relaxed text-primary">
        {children}
      </pre>
    );
  },
  table: ({ children }) => (
    <div className="my-2.5 max-w-full overflow-x-auto rounded-lg border border-primary/[0.06]">
      <table className="w-full min-w-0 border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-codeblock/80 text-secondary">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-primary/[0.08] px-3 py-2 font-medium whitespace-nowrap">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-primary/[0.05] px-3 py-2 align-top break-words text-primary">{children}</td>
  ),
  tr: ({ children }) => <tr className="last:[&>td]:border-b-0">{children}</tr>,
};

export function MarkdownContent({
  children,
  className = "",
  streaming = false,
}: {
  children: string;
  className?: string;
  streaming?: boolean;
}) {
  const text = prepareAnswerMarkdown(children, streaming);
  if (!text) return null;
  return (
    <div className={`markdown-content min-w-0 max-w-full text-sm leading-relaxed text-primary ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
