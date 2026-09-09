import type { Metadata } from "next";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://arcterminals.xyz";
const projectName = process.env.NEXT_PUBLIC_PROJECT_NAME ?? "ARC TERMINALS";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: `${projectName} — TERMINAL`,
  description: "Boot into the ARC Terminals network. Earn points, refer users, climb the leaderboard.",
  openGraph: {
    title: `${projectName} — TERMINAL`,
    description: "Boot into the ARC Terminals network.",
    url: siteUrl,
    siteName: projectName,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${projectName} — TERMINAL`,
    description: "Boot into the ARC Terminals network.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`font-mono bg-term-bg text-phosphor antialiased`}>
        {children}
      </body>
    </html>
  );
}
