import { OfflineCacheWarmer } from "@/components/offline-cache-warmer";
import { cacheVersion } from "@/lib/cache-version";
import { getRooms } from "@/lib/inventory/queries";
import { getScheduleSettings } from "@/lib/scheduler/queries";
import { getHomeProfile, getProposals, getTasks } from "@/lib/tasks/queries";

const TASK_PAGES = ["/tasks", "/tasks/review", "/home-profile", "/settings"];

/**
 * Keeps the offline copies of every task page current; they all show the same data. The plan
 * and today's session are built from the tasks, so their copies are refreshed too once there is
 * a schedule to plan with.
 */
export async function TasksCacheWarmer() {
  const [tasks, proposals, profile, rooms, settings] = await Promise.all([
    getTasks(),
    getProposals(),
    getHomeProfile(),
    getRooms(),
    getScheduleSettings(),
  ]);
  return (
    <OfflineCacheWarmer
      urls={settings ? [...TASK_PAGES, "/plan", "/"] : TASK_PAGES}
      version={cacheVersion([tasks, proposals, profile, rooms, settings])}
    />
  );
}
