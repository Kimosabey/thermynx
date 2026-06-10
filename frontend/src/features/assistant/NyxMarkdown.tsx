import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Shared markdown renderer for Nyx answers — same styling as the analyzer's
 * MarkdownRenderer, accepts citation `components` overrides.
 *
 * The legacy version wrapped ReactMarkdown in a Chakra <Box sx={{ ... }}>; here
 * the same element-scoped styling is reproduced with arbitrary `[&_tag]:`
 * utilities on the wrapping div.
 */
export interface NyxMarkdownProps {
  content?: string;
  components?: Components;
}

const MD_CLASSES = [
  "overflow-hidden max-w-full",
  // h2,h3 — fontWeight 700, mt 5 (20px), mb 2 (8px), text.primary
  "[&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-ink",
  "[&_h3]:font-bold [&_h3]:mt-5 [&_h3]:mb-2",
  // h2 — md (16px), bottom border, pb 2 (8px)
  "[&_h2]:text-base [&_h2]:border-b [&_h2]:border-border-subtle [&_h2]:pb-2",
  // h3 — sm (14px), accent.cyan
  "[&_h3]:text-sm [&_h3]:text-cyan",
  // p — mb 3 (12px), lineHeight 1.8, text.primary, sm, break-word
  "[&_p]:mb-3 [&_p]:leading-[1.8] [&_p]:text-ink [&_p]:text-sm [&_p]:break-words",
  // ul,ol — pl 5 (20px), mb 3 (12px)
  "[&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:pl-5 [&_ol]:mb-3",
  "[&_ul]:list-disc [&_ol]:list-decimal",
  // li — mb 1 (4px), text.primary, sm, break-word
  "[&_li]:mb-1 [&_li]:text-ink [&_li]:text-sm [&_li]:break-words",
  // strong — text.primary, fontWeight 600
  "[&_strong]:text-ink [&_strong]:font-semibold",
  // code — cyan tint bg, padding, radius, 0.82em, accent.cyan, mono, break-all
  "[&_code]:bg-[rgba(6,182,212,0.08)] [&_code]:px-[5px] [&_code]:py-[2px] [&_code]:rounded-[5px] [&_code]:text-[0.82em] [&_code]:text-cyan [&_code]:font-mono [&_code]:break-all",
  // pre — bg.elevated, border, p 4 (16px), radius 10px, scroll, mb 3, xs
  "[&_pre]:bg-elevated [&_pre]:border [&_pre]:border-border-subtle [&_pre]:p-4 [&_pre]:rounded-[10px] [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_pre]:mb-3 [&_pre]:text-xs",
  // pre code — reset code styling inside pre
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit",
  // table — full width, collapse, mb 3, sm, block scroll, mono
  "[&_table]:w-full [&_table]:border-collapse [&_table]:mb-3 [&_table]:text-sm [&_table]:block [&_table]:overflow-x-auto [&_table]:max-w-full [&_table]:font-mono",
  // th,td — border, px 3 (12px), py 6px, left
  "[&_th]:border [&_th]:border-border-subtle [&_th]:px-3 [&_th]:py-[6px] [&_th]:text-left",
  "[&_td]:border [&_td]:border-border-subtle [&_td]:px-3 [&_td]:py-[6px] [&_td]:text-left",
  // th — bg.elevated, fontWeight 600, xs, text.muted
  "[&_th]:bg-elevated [&_th]:font-semibold [&_th]:text-xs [&_th]:text-ink-muted",
  // td — text.primary
  "[&_td]:text-ink",
  // blockquote — left border accent.cyan, pl 4, ml 0, text.muted, italic, opacity
  "[&_blockquote]:border-l-2 [&_blockquote]:border-cyan [&_blockquote]:pl-4 [&_blockquote]:ml-0 [&_blockquote]:text-ink-muted [&_blockquote]:italic [&_blockquote]:opacity-80",
  // img — max width, auto height
  "[&_img]:max-w-full [&_img]:h-auto",
  // a — accent.cyan, break-all
  "[&_a]:text-cyan [&_a]:break-all",
].join(" ");

export default function NyxMarkdown({ content, components }: NyxMarkdownProps) {
  return (
    <div className={MD_CLASSES}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
