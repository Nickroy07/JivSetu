import type { Metadata } from "next";

export const metadata: Metadata = { title: "Clinical workspace", robots: { index: false } };

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
