import DashboardClient from "@/components/dashboard-client";
import { buildFallbackPayload } from "@/lib/dashboard-engine";
import { getLatestSnapshot, getOrCreateSettings } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const settings = await getOrCreateSettings();
  const latest = await getLatestSnapshot();
  const payload = latest ?? (await buildFallbackPayload(settings));

  return <DashboardClient initialPayload={payload} initialSettings={settings} />;
}
