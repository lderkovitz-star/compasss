import type { Metadata } from "next";
import { Inter } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "CognitiveEdge — Executive Assessment Platform",
  description: "AI-powered cognitive and behavioral assessment platform for executive talent evaluation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased bg-gradient-navy text-slate-100 min-h-screen`}>
        <NextTopLoader
          color="#3B82F6"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #3B82F6,0 0 5px #3B82F6"
        />
        {children}
        <Toaster 
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#0F172A',
              fontWeight: 500,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              borderRadius: '12px',
            },
          }}
        />
      </body>
    </html>
  );
}
