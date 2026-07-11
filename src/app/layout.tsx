import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Opsdeck · Infrastructure Console",
  description: "Private operations console for VPS resources, projects, Docker, GitHub Actions, deployments, logs, and alerts.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
