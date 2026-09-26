"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronRight } from "lucide-react";

/** Longer names first so `thinking` wins over `think`. */
const REASONING_TAG = "thinking|thought|reasoning|analysis|think";

export type SplitReasoning = {
  thinking: string;
  answer: string;
  /** An opening reasoning tag has not closed yet. */
  thinkingLive: boolean;
};

function normalizeReasoningTags(text: string): string {
  return text.replace(
    new RegExp(`&lt;(/?)(${REASONING_TAG})\\b([^&>]*)&gt;`, "gi"),
    "<$1$2$3>",
  );
}

const REASONING_NAMES = ["thinking", "thought", "reasoning", "analysis", "think"] as const;

/** Hide a tag that is still arriving so `<thought` never flashes in the answer. */
function stripDanglingReasoningTag(text: string): string {
  return text.replace(/<\/?[a-z]*$/i, (tag) => {
    const name = tag.replace(/^<\/?/, "").toLowerCase();
    if (!name || REASONING_NAMES.some((known) => known.startsWith(name))) return "";
    return tag;
  });
}

/** Pull reasoning tags out of a completion. The answer is everything outside them. */
export function splitReasoning(raw: string, streaming = false): SplitReasoning {
  let text = normalizeReasoningTags(raw.replace(/\r\n/g, "\n"));
  if (streaming) text = stripDanglingReasoningTag(text);

  const openRe = new RegExp(`<(${REASONING_TAG})\\b[^>]*>`, "gi");
  let thinking = "";
  let answer = "";
  let cursor = 0;
  let thinkingLive = false;
  let match: RegExpExecArray | null;

  while ((match = openRe.exec(text))) {
    answer += text.slice(cursor, match.index);
    const bodyStart = match.index + match[0].length;
    const closeRe = new RegExp(`</${match[1]}>`, "i");
    const body = text.slice(bodyStart);
    const close = closeRe.exec(body);
    if (!close) {
      if (thinking) thinking += "\n\n";
      thinking += body;
      thinkingLive = true;
      cursor = text.length;
      break;
    }
    if (thinking) thinking += "\n\n";
    thinking += body.slice(0, close.index);
    cursor = bodyStart + close.index + close[0].length;
    openRe.lastIndex = cursor;
  }
  if (!thinkingLive) answer += text.slice(cursor);

  return { thinking: thinking.trim(), answer, thinkingLive };
}

/** Hide model reasoning and keep partial markdown from swallowing the answer. */
export function prepareAnswerMarkdown(raw: string, streaming = false): string {
  let text = splitReasoning(raw, streaming).answer;
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

function buildComponents(muted: boolean): Components {
  const ink = muted ? "text-secondary" : "text-primary";
  const strong = muted ? "font-medium text-secondary" : "font-semibold text-primary";
  return {
    h1: ({ children }) => (
      <h1 className={`mt-3 mb-1.5 text-sm font-semibold tracking-tight first:mt-0 ${ink}`}>{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className={`mt-3 mb-1.5 text-sm font-semibold tracking-tight first:mt-0 ${ink}`}>{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className={`mt-3 mb-1 text-sm font-semibold first:mt-0 ${ink}`}>{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className={`mt-2.5 mb-1 text-sm font-medium first:mt-0 ${ink}`}>{children}</h4>
    ),
    p: ({ children }) => (
      <p className={`my-2.5 max-w-full text-sm leading-relaxed break-words [overflow-wrap:anywhere] first:mt-0 last:mb-0 ${ink}`}>
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul className={`my-2.5 list-disc space-y-1 pl-5 text-sm leading-relaxed marker:text-secondary ${ink}`}>
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className={`my-2.5 list-decimal space-y-1 pl-5 text-sm leading-relaxed marker:text-secondary ${ink}`}>
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="min-w-0 break-words pl-0.5 [overflow-wrap:anywhere]">{children}</li>,
    strong: ({ children }) => <strong className={strong}>{children}</strong>,
    em: ({ children }) => <em className={`italic ${muted ? "text-secondary" : "text-primary/90"}`}>{children}</em>,
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
        return <code className={`font-mono text-sm leading-relaxed whitespace-pre ${ink}`}>{children}</code>;
      }
      return (
        <code className={`rounded-md bg-codeblock px-1.5 py-0.5 font-mono text-[13px] ${ink}`}>{children}</code>
      );
    },
    pre: ({ children }) => {
      const codeElement = (Array.isArray(children) ? children[0] : children) as {
        props?: { children?: unknown; className?: string };
      };
      const raw = codeElement?.props?.children;
      const code = typeof raw === "string" ? raw.replace(/\n$/, "") : "";
      const className = codeElement?.props?.className || "";
      const lang = /language-([a-zA-Z0-9_-]+)/.exec(className)?.[1];
      if (code && (!lang || /^(text|txt|markdown|md)$/i.test(lang)) && looksLikeProse(code)) {
        return <MarkdownContent muted={muted}>{code}</MarkdownContent>;
      }
      return (
        <pre className="my-2.5 max-w-full overflow-x-auto rounded-lg border border-primary/[0.06] bg-codeblock px-3 py-2.5 font-mono text-sm leading-relaxed">
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
      <td className={`border-b border-primary/[0.05] px-3 py-2 align-top break-words ${ink}`}>{children}</td>
    ),
    tr: ({ children }) => <tr className="last:[&>td]:border-b-0">{children}</tr>,
  };
}

export function MarkdownContent({
  children,
  className = "",
  streaming = false,
  muted = false,
}: {
  children: string;
  className?: string;
  streaming?: boolean;
  muted?: boolean;
}) {
  const text = prepareAnswerMarkdown(children, streaming);
  const components = useMemo(() => buildComponents(muted), [muted]);
  if (!text) return null;
  return (
    <div
      className={`markdown-content min-w-0 max-w-full text-sm leading-relaxed ${muted ? "text-secondary" : "text-primary"} ${className}`.trim()}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

function thoughtLabel(live: boolean, elapsedMs: number | null): string {
  if (live) return "Thinking…";
  if (elapsedMs == null || elapsedMs < 800) return "Thought briefly";
  const seconds = Math.max(1, Math.round(elapsedMs / 1000));
  return `Thought for ${seconds} ${seconds === 1 ? "second" : "seconds"}`;
}

/** Collapsible reasoning trace. Stays open while tokens arrive, then folds like DeepSeek. */
export function ThinkingTrace({
  text,
  live,
  collapseWhenDone = true,
}: {
  text: string;
  live: boolean;
  collapseWhenDone?: boolean;
}) {
  const [open, setOpen] = useState(live);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const started = useRef<number | null>(null);
  const seenLive = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!text) {
      started.current = null;
      seenLive.current = false;
      setElapsedMs(null);
      return;
    }
    if (started.current == null) started.current = Date.now();
    if (live) {
      seenLive.current = true;
      return;
    }
    setElapsedMs(Date.now() - started.current);
    if (seenLive.current && collapseWhenDone) {
      seenLive.current = false;
      setOpen(false);
    }
  }, [text, live, collapseWhenDone]);

  useEffect(() => {
    if (!live || !open) return;
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text, live, open]);

  if (!text) return null;

  return (
    <div className="mt-3 min-w-0 max-w-full">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1 text-[13px] leading-5 text-secondary transition-colors hover:text-primary"
      >
        <ChevronRight
          className={`size-3.5 shrink-0 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
          aria-hidden
        />
        <span className={live ? "animate-pulse" : undefined}>{thoughtLabel(live, elapsedMs)}</span>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="min-h-0 overflow-hidden" inert={open ? undefined : true} aria-hidden={open ? undefined : true}>
          <div
            ref={bodyRef}
            className="mt-2 max-h-40 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain border-l border-primary/15 pl-3"
          >
            <MarkdownContent muted streaming={live}>
              {text}
            </MarkdownContent>
          </div>
        </div>
      </div>
    </div>
  );
}
