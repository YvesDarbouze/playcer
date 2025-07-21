import { Dashboard } from "@/components/dashboard";
import { courts } from "@/lib/data";

export default function Home() {
  // In a real application, you would fetch this data from an API.
  const allCourts = courts;

  return (
    <main>
      <Dashboard courts={allCourts} />
    </main>
  );
}
