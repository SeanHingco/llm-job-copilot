import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
// import AppHeader from "components/AppHeader";
import HeaderGate from "components/HeaderGate";
import Footer from "components/Footer"
// import Head from "next/head";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Resume Bender",
  description: "Job Application Copilot Tool",
  // themeColor: "#4b00cc",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "Resume Bender",
    description: "AI-powered resume & job prep copilot.",
    url: "https://resume-bender.seanhing.co",   // update to your real domain
    siteName: "Resume Bender",
    images: [
      {
        url: "/og.png",  // your file in /public
        width: 1200,
        height: 630,
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Resume Bender",
    description: "AI-powered resume & job prep copilot.",
    images: ["/og.png"],
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"       // uses class="dark"
          defaultTheme="system"   // follow OS by default
          enableSystem
          disableTransitionOnChange
        >
          <HeaderGate />
          {children}
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
