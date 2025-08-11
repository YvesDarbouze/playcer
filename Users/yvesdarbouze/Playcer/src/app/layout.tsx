
import type { Metadata } from "next";
import { Open_Sans, Montserrat } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";

const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-sans", weight: ["400", "700"] });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["900"], variable: "--font-headline" });

export const metadata: Metadata = {
  title: "Playcer",
  description: "Peer to peer sports betting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased flex flex-col", openSans.variable, montserrat.variable)}>
        <AuthProvider>
          <SiteHeader />
          <div className="flex-grow">
            {children}
          </div>
          <Footer />
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
