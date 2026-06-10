import { type ReactNode } from "react";

/**
 * 40×40 gradient icon tile used in PageHeader to visually anchor each page.
 * White Lucide icon (size 20, stroke 1.85) on a brand-gradient square.
 *
 * Usage:
 *   <PageHeader title="AI Agents" icon={<PageHeaderIcon icon={<Bot size={20} strokeWidth={1.85} />} />} />
 *   <PageHeaderIcon icon={<ScanSearch size={20} />} gradient="linear-gradient(135deg, #1F3FFE, #000F64)" />
 *
 * Default gradient is THERMYNX's blue→thermal-cyan signature.
 */
export default function PageHeaderIcon({
  icon,
  gradient = "linear-gradient(135deg, #1F3FFE, #06B6D4)",
}: {
  icon: ReactNode;
  gradient?: string;
}) {
  return (
    <div
      className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white shadow-[0_4px_20px_rgba(31,63,254,0.30)]"
      style={{ background: gradient }}
    >
      {icon}
    </div>
  );
}
