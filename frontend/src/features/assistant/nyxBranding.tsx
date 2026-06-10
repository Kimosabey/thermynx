import { Sparkles } from "lucide-react";

// Nyx persona gradient — the THERMYNX blue→thermal-cyan signature.
export const NYX_GRADIENT = "linear-gradient(135deg, #1F3FFE, #06B6D4)";

export interface NyxAvatarProps {
  size?: string;
  icon?: number;
}

/** Gradient avatar tile for Nyx (mirrors the model-toast icon tile). */
export function NyxAvatar({ size = "32px", icon = 18 }: NyxAvatarProps) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-[10px] text-white"
      style={{
        width: size,
        height: size,
        backgroundImage: NYX_GRADIENT,
        boxShadow: "0 4px 14px rgba(6,182,212,0.35)",
      }}
    >
      <Sparkles size={icon} strokeWidth={2} />
    </div>
  );
}
