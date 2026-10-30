import { redirect } from "next/navigation";

// Keep the original mobile-first interface as the source of truth while the
// native React migration is brought to full feature parity.
export default function HomePage() {
  redirect("/index.html");
}
