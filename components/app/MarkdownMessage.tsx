"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import "katex/dist/katex.min.css";
import { MermaidDiagram } from "@/components/app/MermaidDiagram";

/**
 * Renders AI Tutor responses as real formatted content instead of plain
 * text - the specific, named failure this fixes: equations were
 * displaying as raw LaTeX source ($$...$$) because nothing in the chat
 * pipeline ever parsed markdown at all (see the plain {m.content} this
 * replaces in ChatMessages.tsx). remark-math + rehype-katex handle
 * inline ($...$) and display ($$...$$) math; a ```mermaid fenced code
 * block renders as an actual diagram via the same MermaidDiagram used by
 * the Visualize highlight-to-ask action, so the model can produce
 * flowcharts/diagrams the same way that action does, not just describe them.
 */
export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="markdown-body space-y-3 text-sm leading-relaxed text-paper">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ children }) => <h1 className="mt-4 font-display text-xl text-paper first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-3 font-display text-lg text-paper first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-2 font-display text-base text-paper first:mt-0">{children}</h3>,
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="ml-4 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="ml-4 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-ai-accent/50 bg-ai-accent/5 py-1 pl-3 text-paper-dim">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-lg border border-ink-border">
              <table className="w-full text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-ink-surface">{children}</thead>,
          th: ({ children }) => <th className="border-b border-ink-border px-2.5 py-1.5 text-left font-medium text-paper">{children}</th>,
          td: ({ children }) => <td className="border-b border-ink-border/50 px-2.5 py-1.5 text-paper-dim">{children}</td>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-ai-accent underline underline-offset-2 hover:text-ai-accent-deep">
              {children}
            </a>
          ),
          hr: () => <hr className="border-ink-border" />,
          strong: ({ children }) => <strong className="font-semibold text-paper">{children}</strong>,
          code(props) {
            const { className, children, ...rest } = props as {
              className?: string;
              children?: React.ReactNode;
              inline?: boolean;
            };
            const match = /language-(\w+)/.exec(className || "");
            const lang = match?.[1];
            const codeText = String(children).replace(/\n$/, "");

            if (!match) {
              return (
                <code className="rounded bg-ink-border/60 px-1.5 py-0.5 font-mono text-[0.85em] text-achievement" {...rest}>
                  {children}
                </code>
              );
            }

            if (lang === "mermaid") {
              return <MermaidDiagram chart={codeText} />;
            }

            return (
              <div className="overflow-hidden rounded-lg border border-ink-border">
                {lang && (
                  <div className="flex items-center justify-between border-b border-ink-border bg-ink-surface px-3 py-1">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-paper-faint">{lang}</span>
                  </div>
                )}
                <SyntaxHighlighter
                  language={lang}
                  style={oneDark}
                  customStyle={{ margin: 0, fontSize: "0.8rem", background: "transparent" }}
                >
                  {codeText}
                </SyntaxHighlighter>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
