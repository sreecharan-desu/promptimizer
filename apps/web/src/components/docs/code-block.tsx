"use client";

import { useState } from "react";
import { Copy, Check, Terminal, FileCode2, Braces, FileText } from "lucide-react";

export interface CodeBlockProps {
  code: string;
  label?: string;
  className?: string;
}

type TokenType =
  | "plain"
  | "comment"
  | "control"
  | "keyword"
  | "type"
  | "function"
  | "property"
  | "variable"
  | "string"
  | "number"
  | "boolean"
  | "flag"
  | "subcommand"
  | "url"
  | "punctuation";

interface Token {
  type: TokenType;
  text: string;
}

const TOKEN_STYLES: Record<TokenType, string> = {
  plain: "text-[#d4d4d4]",
  comment: "text-[#6a9955] italic",
  control: "text-[#c586c0] font-medium",
  keyword: "text-[#569cd6] font-medium",
  type: "text-[#4ec9b0] font-medium",
  function: "text-[#dcdcaa]",
  property: "text-[#9cdcfe]",
  variable: "text-[#9cdcfe]",
  string: "text-[#ce9178]",
  number: "text-[#b5cea8]",
  boolean: "text-[#569cd6] font-medium",
  flag: "text-[#4fc1ff]",
  subcommand: "text-[#9cdcfe]",
  url: "text-[#4ec9b0] underline decoration-[#4ec9b0]/30",
  punctuation: "text-[#d4d4d4]/80",
};

const TS_CONTROL = new Set([
  "import",
  "from",
  "export",
  "default",
  "return",
  "if",
  "else",
  "switch",
  "case",
  "break",
  "try",
  "catch",
  "finally",
  "throw",
  "while",
  "for",
  "of",
  "in",
]);

const TS_KEYWORD = new Set([
  "const",
  "let",
  "var",
  "function",
  "async",
  "await",
  "new",
  "class",
  "interface",
  "type",
  "extends",
  "implements",
  "typeof",
  "instanceof",
  "as",
  "declare",
]);

const TS_BOOLEAN = new Set(["true", "false", "null", "undefined"]);

const TS_TYPES = new Set([
  "Promptimizer",
  "OpenAI",
  "Record",
  "Promise",
  "Response",
  "Request",
  "string",
  "number",
  "boolean",
  "any",
  "void",
  "unknown",
  "never",
  "object",
]);

const BASH_COMMANDS = new Set([
  "curl",
  "npm",
  "npx",
  "promptimizer",
  "promptimizer-cli",
  "export",
  "echo",
  "cat",
  "cd",
  "git",
  "node",
  "pnpm",
  "yarn",
  "bun",
]);

const BASH_SUBCOMMANDS = new Set([
  "install",
  "login",
  "connect",
  "chat",
  "models",
  "savings",
  "run",
  "create",
  "test",
  "build",
  "start",
  "dev",
  "status",
  "help",
]);

function tokenizeLine(line: string, lang: string): Token[] {
  const norm = lang.toLowerCase().trim();
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    const rest = line.slice(i);

    // Comments
    if (norm === "bash" || norm === "sh" || norm === "shell" || norm === "zsh") {
      if (rest.startsWith("#")) {
        tokens.push({ type: "comment", text: rest });
        break;
      }
    } else {
      if (rest.startsWith("//")) {
        tokens.push({ type: "comment", text: rest });
        break;
      }
    }

    // Whitespace
    const wsMatch = rest.match(/^\s+/);
    if (wsMatch) {
      tokens.push({ type: "plain", text: wsMatch[0] });
      i += wsMatch[0].length;
      continue;
    }

    // Strings (double quote, single quote, template backtick)
    if (rest[0] === '"' || rest[0] === "'" || rest[0] === "`") {
      const quote = rest[0];
      let str = quote;
      let j = 1;
      let escaped = false;
      while (j < rest.length) {
        const ch = rest[j];
        str += ch;
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === quote) {
          j++;
          break;
        }
        j++;
      }

      // If JSON and followed by a colon (or quotes with colon), check if key
      if (norm === "json" && /^\s*:/.test(rest.slice(str.length))) {
        tokens.push({ type: "property", text: str });
      } else {
        tokens.push({ type: "string", text: str });
      }
      i += str.length;
      continue;
    }

    // URLs in bash or text
    const urlMatch = rest.match(/^https?:\/\/[^\s"'`)\\]+/);
    if (urlMatch) {
      tokens.push({ type: "url", text: urlMatch[0] });
      i += urlMatch[0].length;
      continue;
    }

    // Bash flags: -H, -d, -s, --key, --help
    if ((norm === "bash" || norm === "sh" || norm === "shell") && rest.startsWith("-")) {
      const flagMatch = rest.match(/^--?[a-zA-Z0-9_\-]+/);
      if (flagMatch) {
        tokens.push({ type: "flag", text: flagMatch[0] });
        i += flagMatch[0].length;
        continue;
      }
    }

    // Bash or JS Env variables: $PROMPTIMIZER_API_KEY, $VAR, process.env.VAR
    if (rest.startsWith("$")) {
      const envMatch = rest.match(/^\$[a-zA-Z0-9_]+/);
      if (envMatch) {
        tokens.push({ type: "variable", text: envMatch[0] });
        i += envMatch[0].length;
        continue;
      }
    }

    const procEnvMatch = rest.match(/^process\.env\.[a-zA-Z0-9_]+/);
    if (procEnvMatch) {
      tokens.push({ type: "variable", text: procEnvMatch[0] });
      i += procEnvMatch[0].length;
      continue;
    }

    // Numbers (integers and floats)
    const numMatch = rest.match(/^[0-9]+(?:\.[0-9]+)?\b/);
    if (numMatch) {
      tokens.push({ type: "number", text: numMatch[0] });
      i += numMatch[0].length;
      continue;
    }

    // Words / Identifiers
    const wordMatch = rest.match(/^[a-zA-Z_][a-zA-Z0-9_\-]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      const afterWord = rest.slice(word.length);

      if (norm === "json") {
        if (word === "true" || word === "false" || word === "null") {
          tokens.push({ type: "boolean", text: word });
        } else {
          tokens.push({ type: "plain", text: word });
        }
      } else if (norm === "bash" || norm === "sh" || norm === "shell") {
        if (BASH_COMMANDS.has(word)) {
          tokens.push({ type: "function", text: word });
        } else if (BASH_SUBCOMMANDS.has(word)) {
          tokens.push({ type: "subcommand", text: word });
        } else {
          tokens.push({ type: "plain", text: word });
        }
      } else {
        // TypeScript / JavaScript / Default
        if (TS_CONTROL.has(word)) {
          tokens.push({ type: "control", text: word });
        } else if (TS_KEYWORD.has(word)) {
          tokens.push({ type: "keyword", text: word });
        } else if (TS_BOOLEAN.has(word)) {
          tokens.push({ type: "boolean", text: word });
        } else if (TS_TYPES.has(word) || /^[A-Z][a-zA-Z0-9_]*$/.test(word)) {
          tokens.push({ type: "type", text: word });
        } else if (/^\s*\(/.test(afterWord)) {
          tokens.push({ type: "function", text: word });
        } else if (/^\s*:/.test(afterWord) && !/^\s*::/.test(afterWord)) {
          tokens.push({ type: "property", text: word });
        } else {
          tokens.push({ type: "variable", text: word });
        }
      }

      i += word.length;
      continue;
    }

    // Punctuation and symbols
    tokens.push({ type: "punctuation", text: rest[0] });
    i += 1;
  }

  return tokens;
}

function getTabMetadata(label?: string) {
  const norm = (label || "").toLowerCase().trim();

  if (norm === "bash" || norm === "sh" || norm === "shell" || norm === "cli") {
    return {
      fileName: "terminal.sh",
      displayLang: "BASH",
      icon: Terminal,
      iconColor: "text-emerald-400",
    };
  }

  if (norm === "ts" || norm === "typescript") {
    return {
      fileName: "example.ts",
      displayLang: "TYPESCRIPT",
      icon: FileCode2,
      iconColor: "text-sky-400",
    };
  }

  if (norm === "js" || norm === "javascript") {
    return {
      fileName: "example.js",
      displayLang: "JAVASCRIPT",
      icon: FileCode2,
      iconColor: "text-amber-400",
    };
  }

  if (norm === "json") {
    return {
      fileName: "payload.json",
      displayLang: "JSON",
      icon: Braces,
      iconColor: "text-amber-400",
    };
  }

  if (norm === "python" || norm === "py") {
    return {
      fileName: "example.py",
      displayLang: "PYTHON",
      icon: FileCode2,
      iconColor: "text-yellow-400",
    };
  }

  return {
    fileName: label ? `${label}.txt` : "code.txt",
    displayLang: label ? label.toUpperCase() : "CODE",
    icon: FileText,
    iconColor: "text-zinc-400",
  };
}

export function CodeBlock({ code, label, className = "" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const normalizedCode = code.replace(/\r\n/g, "\n").trim();
  const lines = normalizedCode.split("\n");
  const meta = getTabMetadata(label);
  const Icon = meta.icon;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(normalizedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  return (
    <div
      className={`group my-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1a1a1c] shadow-[0_12px_36px_-16px_rgba(0,0,0,0.55)] transition-all duration-200 hover:border-white/[0.14] ${className}`.trim()}
    >
      {/* VS Code Title Bar */}
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#141416] px-3.5 py-2">
        {/* Left: macOS Window Controls & Active Tab */}
        <div className="flex items-center gap-3">
          {/* Traffic light buttons */}
          <div className="flex items-center gap-1.5 pr-1.5" aria-hidden="true">
            <span className="size-3 rounded-full bg-[#ff5f56] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.2)]" />
            <span className="size-3 rounded-full bg-[#ffbd2e] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.2)]" />
            <span className="size-3 rounded-full bg-[#27c93f] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.2)]" />
          </div>

          {/* Active Tab */}
          <div className="flex items-center gap-2 rounded-t-md border-t-2 border-[#007acc] bg-[#1a1a1c] px-3 py-1 text-[12px] font-mono font-medium text-zinc-300">
            <Icon className={`size-3.5 ${meta.iconColor}`} />
            <span>{meta.fileName}</span>
          </div>
        </div>

        {/* Right: Language Pill & Copy Button */}
        <div className="flex items-center gap-2">
          <span className="rounded bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-zinc-400 border border-white/[0.06]">
            {meta.displayLang}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            title="Copy code to clipboard"
            aria-label="Copy code"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors duration-150 hover:bg-white/[0.08] hover:text-white active:scale-95"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-400" />
                <span className="font-semibold text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="overflow-x-auto p-4 font-mono text-[13px] leading-[1.65] selection:bg-[#264f78] selection:text-white">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((lineText, idx) => {
              const tokens = tokenizeLine(lineText, label || "");
              const lineNum = idx + 1;

              return (
                <tr key={idx} className="group/line transition-colors duration-100 hover:bg-white/[0.03]">
                  {/* Line Number Gutter */}
                  <td className="w-10 select-none pr-4 text-right align-top font-mono text-[12px] text-[#858585]/60 transition-colors group-hover/line:text-zinc-400 border-r border-white/[0.06]">
                    {lineNum}
                  </td>
                  {/* Code Line Content */}
                  <td className="pl-4 align-top whitespace-pre font-mono">
                    {tokens.length === 0 ? (
                      <span>&nbsp;</span>
                    ) : (
                      tokens.map((token, tIdx) => (
                        <span key={tIdx} className={TOKEN_STYLES[token.type]}>
                          {token.text}
                        </span>
                      ))
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
