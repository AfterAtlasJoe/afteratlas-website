import type { Metadata } from "next";

/** Functional/private route — nothing here is content worth surfacing in search results. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
