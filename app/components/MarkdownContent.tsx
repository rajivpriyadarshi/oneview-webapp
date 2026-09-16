"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import type { PluggableList } from "unified";

export const markdownContentClassName =
  "[overflow-wrap:anywhere] font-satoshi text-[15px] leading-[24px] text-black/72 [&_a]:text-[#0e5f5b] [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-[#0e5f5b]/20 [&_blockquote]:pl-[14px] [&_blockquote]:text-[#171615]/70 [&_code]:rounded [&_code]:bg-[#171615]/10 [&_code]:px-[6px] [&_code]:py-[2px] [&_code]:font-mono [&_code]:text-[0.88em] [&_h1]:mb-[10px] [&_h1]:text-[1em] [&_h1]:font-bold [&_h2]:mb-[10px] [&_h2]:text-[1em] [&_h2]:font-bold [&_h3]:mb-[10px] [&_h3]:text-[1em] [&_h3]:font-bold [&_li]:my-[4px] [&_ol]:mb-[16px] [&_ol]:list-decimal [&_ol]:pl-[20px] [&_p]:mb-[16px] [&_pre]:mb-[16px] [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-[#171615]/10 [&_pre]:p-[12px] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-bold [&_table]:mb-[16px] [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[#171615]/10 [&_td]:p-[8px] [&_th]:border [&_th]:border-[#171615]/10 [&_th]:bg-white/60 [&_th]:p-[8px] [&_th]:text-left [&_th]:font-bold [&_ul]:mb-[16px] [&_ul]:list-disc [&_ul]:pl-[20px] [&>*:last-child]:mb-0";

function remarkCapsHeadings() {
  return (tree: import("mdast").Root) => {
    visit(tree, "paragraph", (node: import("mdast").Paragraph, index: number | undefined, parent: import("mdast").Parent | undefined) => {
      if (!parent || index == null) return;
      const raw = node.children.map((child) => ("value" in child ? child.value : "")).join("").trim();
      const isAllCaps = /^[A-Z][A-Z\s\d\-&/]{1,58}:?$/.test(raw);
      const isTitleHeading = raw.length <= 60 && /^[A-Z]/.test(raw) && /[?:]$/.test(raw) && !/\./.test(raw);
      if (!isAllCaps && !isTitleHeading) return;
      node.children = [{
        type: "strong",
        data: { hProperties: { className: ["heading"] } },
        children: [{ type: "text", value: raw }],
      } as unknown as import("mdast").Strong];
    });
  };
}

function remarkInlineBullets() {
  return (tree: import("mdast").Root) => {
    visit(tree, "paragraph", (node: import("mdast").Paragraph, index: number | undefined, parent: import("mdast").Parent | undefined) => {
      if (!parent || index == null) return;
      const raw = node.children.map((child) => ("value" in child ? child.value : "")).join("");
      if (!raw.includes("•")) return;
      const parts = raw.split("•").map((part) => part.trim()).filter(Boolean);
      if (parts.length < 2) return;

      const makeList = (items: string[]): import("mdast").List => ({
        type: "list",
        ordered: false,
        spread: false,
        children: items.map((text) => ({
          type: "listItem" as const,
          spread: false,
          children: [{ type: "paragraph" as const, children: [{ type: "text" as const, value: text }] }],
        })),
      });

      if (parent.type === "listItem") {
        const [lead, ...rest] = parts;
        const replacements: import("mdast").Content[] = [
          { type: "paragraph", children: [{ type: "text", value: lead }] },
          makeList(rest),
        ];
        parent.children.splice(index, 1, ...replacements);
        return;
      }

      parent.children.splice(index, 1, makeList(parts));
    });
  };
}

function rehypeBoldNumbers() {
  return (tree: import("hast").Root) => {
    const pattern = /(\$[\d,]+(?:\.\d+)?(?:[KMBTkmbt](?:\b|(?=[^a-zA-Z])))?(?:\s*-\s*\$[\d,]+(?:\.\d+)?(?:[KMBTkmbt](?:\b|(?=[^a-zA-Z])))?)?|\b\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?%)/g;
    visit(tree, "text", (node: import("hast").Text, index: number | undefined, parent: import("hast").Parent | undefined) => {
      if (!parent || index == null) return;
      const parts: (import("hast").Text | import("hast").Element)[] = [];
      let last = 0;
      let match;
      pattern.lastIndex = 0;

      while ((match = pattern.exec(node.value)) !== null) {
        if (match.index > last) {
          parts.push({ type: "text", value: node.value.slice(last, match.index) });
        }
        parts.push({
          type: "element",
          tagName: "strong",
          properties: { className: ["num"] },
          children: [{ type: "text", value: match[0] }],
        });
        last = match.index + match[0].length;
      }

      if (parts.length === 0) return;
      if (last < node.value.length) {
        parts.push({ type: "text", value: node.value.slice(last) });
      }
      parent.children.splice(index, 1, ...parts);
    });
  };
}

export default function MarkdownContent({
  children,
  className = "",
  extraRehypePlugins,
}: {
  children: string;
  className?: string;
  /**
   * Appended after the built-in rehype pass, for callers that need to decorate
   * the rendered text — e.g. marking masked PII inline. Omitted everywhere by
   * default, so the standard pipeline is untouched.
   */
  extraRehypePlugins?: PluggableList;
}) {
  return (
    <div className={`${markdownContentClassName} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCapsHeadings, remarkInlineBullets]}
        rehypePlugins={[rehypeBoldNumbers, ...(extraRehypePlugins ?? [])]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
