import type React from "react";
import styles from "./NeonBorder.module.css";

type NeonBorderProps = {
  color?: string;
  thickness?: number;
  speedSeconds?: number;
  opacity?: number;
};

type NeonBorderStyle = React.CSSProperties & {
  ["--neon-rgb"]?: string;
  ["--neon-size"]?: string;
  ["--neon-duration"]?: string;
  ["--neon-opacity"]?: number;
};

function hexToRgbTriplet(input: string): string | null {
  const hex = input.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const normalized = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export function NeonBorder({
  color = "#00ff88",
  thickness = 2,
  speedSeconds = 8,
  opacity = 0.45,
}: NeonBorderProps) {
  const rgb = hexToRgbTriplet(color) || "0, 255, 136";
  const size = Math.max(1, Math.min(6, Math.round(thickness)));
  const duration = Math.max(2, Math.min(20, speedSeconds));
  const alpha = Math.max(0.08, Math.min(0.7, opacity));

  const style: NeonBorderStyle = {
    "--neon-rgb": rgb,
    "--neon-size": `${size}px`,
    "--neon-duration": `${duration}s`,
    "--neon-opacity": alpha,
  };

  return <div aria-hidden="true" className={styles.neonBorder} style={style} />;
}
