import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Inter_Tight, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { MotionProvider } from "@/components/motion/motion-provider";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
// Landing-page serif (vintage title cards + hero). Loaded globally so the font is ready before the film leader runs.
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "VITRA — Reagent colour to measurable data",
    template: "%s · VITRA",
  },
  description:
    "An experimental computer-vision platform for controlled urine-strip analysis, calibration, and clinical review. Research prototype for the KJS-HC-03 use case — not a medical device.",
  applicationName: "VITRA",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#060607",
  colorScheme: "dark",
  width: 1280,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable} ${jetbrains.variable} ${instrumentSerif.variable}`}>
      <body className="min-h-screen bg-ink-0 text-fg antialiased">
        <MotionProvider>
          <ToastProvider>{children}</ToastProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
