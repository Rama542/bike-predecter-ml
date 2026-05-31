import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "BikeSense AI — Intelligent Bike Demand Forecasting",
  description: "AI-powered bike rental demand forecasting. Real-time SARIMA predictions for rental companies and smart pricing for consumers.",
  keywords: "bike rental, demand forecasting, AI, SARIMA, dynamic pricing",
  openGraph: {
    title: "BikeSense AI",
    description: "Intelligent bike rental demand forecasting platform",
    type: "website",
  },
};

const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

async function ClerkWrapper({ children }: { children: React.ReactNode }) {
  if (CLERK_KEY && CLERK_KEY.startsWith("pk_")) {
    const { ClerkProvider } = await import("@clerk/nextjs");
    return <ClerkProvider>{children}</ClerkProvider>;
  }
  return <>{children}</>;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body bg-dark-900 text-white antialiased">
        <ClerkWrapper>
          {children}
        </ClerkWrapper>
        <Toaster position="top-right" toastOptions={{
          style: { background: "#1e293b", color: "#f1f5f9", border: "1px solid rgba(99,102,241,0.3)" }
        }} />
      </body>
    </html>
  );
}
