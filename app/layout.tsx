import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans_KR } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = IBM_Plex_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "살롱 블랙잭",
  description:
    "6덱 블랙잭. 블랙잭은 3:2, 딜러는 소프트 17에서 멈춥니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
