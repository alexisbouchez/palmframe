/* eslint-disable react-refresh/only-export-components */

import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ThreadProvider } from "@/lib/thread-context"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Palmframe",
  description: "AI-powered coding assistant with cloud sandboxes",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ThreadProvider>{children}</ThreadProvider>
      </body>
    </html>
  )
}
