import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const spaceGrotesk = Space_Grotesk({
    subsets: ["latin"],
    variable: "--font-sans",
});
const fraunces = Fraunces({
    subsets: ["latin"],
    variable: "--font-display",
});

export const metadata: Metadata = {
    title: "테일즈런너 설날 떡국 빨리 먹기 대회 | 캐릭터 투표 배분 계산기",
    description: "캐릭터 투표권 배분을 직관적으로 계산하는 최적화 도구",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ko" className={cn(spaceGrotesk.variable, fraunces.variable)}>
            <body className={cn(spaceGrotesk.className, "min-h-screen bg-background text-foreground antialiased")}>
                {children}
            </body>
        </html>
    );
}
