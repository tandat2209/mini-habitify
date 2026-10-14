import { loadDashboard } from "@/features/dashboard/queries";
import { Dashboard } from "@/components/dashboard/dashboard";
export default async function Today() {
  const data = await loadDashboard();
  return <Dashboard key={JSON.stringify(data.preferences)} data={data} />;
}
