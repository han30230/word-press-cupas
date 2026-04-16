import { runPublishJob } from "./jobs/publishJob.js";

void runPublishJob().then((r) => {
  if (!r.ok && r.error) console.error(r.error);
  process.exit(r.ok ? 0 : 1);
});
