import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NorthTap API",
  description: "Canadian credit card catalog and recommendation API",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
