import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, open, unlink } from "node:fs/promises";
import { JsonStorage } from "./storage/jsonStorage.js";
import { loadConfig } from "./config.js";
import { PayRamService } from "./services/payram.service.js";
import { createApp } from "./app.js";
const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(directory, ".env"), quiet: true });
const config = loadConfig();
const dataDir = path.join(directory, "data");
await mkdir(dataDir, { recursive: true });
const lockPath = path.join(dataDir, ".server.lock");
let lock;
try {
  lock = await open(lockPath, "wx", 0o600);
} catch {
  throw new Error(
    "JSON store is locked. Stop the other server. After an unclean shutdown, confirm no server is running before removing server/data/.server.lock.",
  );
}
await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
async function release() {
  await lock.close();
  await unlink(lockPath);
}
try {
  const storage = new JsonStorage(dataDir);
  await storage.init();
  const server = createApp({ storage, provider: new PayRamService(config), config }).listen(
    config.port,
    () => {
      console.info("Store API listening on port " + config.port);
    },
  );
  server.on("error", async () => {
    await release();
    process.exit(1);
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => {
      server.close(async () => {
        await release();
        process.exit(0);
      });
    });
} catch (error) {
  await release();
  throw error;
}
