import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Spoudazõ — Study what actually shows up on the exam",
  description:
    "The academic operating system for Nigerian university students. Upload your course materials, and Spoudazõ mines your past questions for the topics that keep repeating, then tutors, quizzes, and grades you on exactly those.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${plexMono.variable}`}>
      <head>
        {/*
          Runs before hydration/paint - reads the stored theme and applies
          the `dark` class immediately, so a returning dark-mode user
          doesn't see a flash of the light theme before React mounts and
          lib/theme.tsx's effect catches up. Kept deliberately tiny and
          defensive (try/catch) since it runs outside React entirely.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try {
              var t = localStorage.getItem('spoudazo:theme');
              if (t === 'dark') document.documentElement.classList.add('dark');
            } catch (e) {}`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
