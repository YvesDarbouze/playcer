
import type { Metadata } from "next";
import { Open_Sans, Montserrat, Archivo_Black } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";

const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-sans", weight: ["400", "700"] });
const montserrat = Montserrat({ subsets: ["latin"], weight: "900", variable: "--font-headline" });
const archivoBlack = Archivo_Black({ subsets: ["latin"], weight: "400", variable: "--font-logo" });

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
       <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=motion_play" />
      </head>
      <body className={cn("min-h-screen bg-background font-sans antialiased dark flex flex-col", openSans.variable, montserrat.variable, archivoBlack.variable)}>
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
