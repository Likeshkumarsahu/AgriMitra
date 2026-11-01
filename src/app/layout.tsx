import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import Chatbot from "@/components/Chatbot";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { Providers } from "@/components/providers";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AgriMitra — Agriculture Learning & Crop Recommendation Platform",
    template: "%s · AgriMitra",
  },
  description:
    "AgriMitra: 36 agriculture course modules, a 22-crop knowledge base with 15-point guides, an ML-powered crop recommender and a Gemini-powered RAG chatbot.",
  keywords: [
    "agriculture",
    "crops",
    "crop recommendation",
    "soil",
    "NPK",
    "agri courses",
    "chatbot",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <Chatbot />
        </Providers>
      </body>
    </html>
  );
}