import type { Metadata } from "next";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource/share-tech-mono/400.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wright Angles",
  description:
    "Visualize how displays compare from where you actually sit — arc-minute accurate device simulation for UX designers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
