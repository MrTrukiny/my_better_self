import { OfflineCacheWarmer } from "@/components/offline-cache-warmer";
import { cacheVersion } from "@/lib/cache-version";
import { getRooms } from "@/lib/inventory/queries";
import { getHomeProfile, getProposals, getTasks } from "@/lib/tasks/queries";

const TASK_PAGES = ["/tasks", "/tasks/review", "/home-profile", "/plan"];

/** Keeps the offline copies of every task page, and the plan built from them, current. */
export async function TasksCacheWarmer() {
  const [tasks, proposals, profile, rooms] = await Promise.all([
    getTasks(),
    getProposals(),
    getHomeProfile(),
    getRooms(),
  ]);
  return (
    <OfflineCacheWarmer
      urls={TASK_PAGES}
      version={cacheVersion([tasks, proposals, profile, rooms])}
    />
  );
}
