import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

const gitHead = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" });
const revision = (gitHead.status === 0 && gitHead.stdout.trim()) || crypto.randomUUID();

// `dynamic`, `dynamicParams` and `revalidate` are intentionally not re-exported:
// route segment config is incompatible with `cacheComponents`.
export const { generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
});
