import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Workout Tracker",
    template: "%s · Workout Tracker",
  },
  description:
    "Create workout templates, complete your workouts, and keep a history of your progress.",
  applicationName: "Workout Tracker",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Workout Tracker",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0f0c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} h-full antialiased`}>
      <body className="min-h-full bg-bg font-sans text-text">{children}</body>
    </html>
  );
}
