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
    title: "Distribution Calculator",
    description: "Optimal Voting Rights Distribution Calculator",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={cn(spaceGrotesk.variable, fraunces.variable)}>
            <body className={cn(spaceGrotesk.className, "min-h-screen bg-background text-foreground antialiased")}>
                {children}
            </body>
        </html>
    );
}
