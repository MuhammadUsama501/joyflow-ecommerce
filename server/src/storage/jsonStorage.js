import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
const names = [
  "products.json",
  "carts.json",
  "orders.json",
  "payments.json",
  "payment-events.json",
];

/** Single-process queue, atomic replacement, and roll-forward multi-file recovery. */
export class JsonStorage {
  constructor(directory) {
    this.directory = path.resolve(directory);
    this.queue = Promise.resolve();
  }
  file(name) {
    if (!names.includes(name)) throw new Error("Unknown storage file.");
    return path.join(this.directory, name);
  }
  exclusive(work) {
    const next = this.queue.then(work);
    this.queue = next.catch(() => {});
    return next;
  }
  async atomic(file, value) {
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(value, null, 2) + "\n", {
        mode: 0o600,
        flag: "wx",
      });
      await rename(temporary, file);
    } finally {
      await unlink(temporary).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }
  async readFile(name) {
    const file = this.file(name);
    let content;
    try {
      content = await readFile(file, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await this.atomic(file, []);
      return [];
    }
    if (!content.trim()) return [];
    try {
      const data = JSON.parse(content);
      if (!Array.isArray(data)) throw new Error("Expected an array");
      return data;
    } catch {
      throw new Error(`Invalid JSON in ${name}; restore a backup before continuing.`);
    }
  }
  async recover() {
    const journal = path.join(this.directory, ".transaction.json");
    let pending;
    try {
      pending = JSON.parse(await readFile(journal, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const [name, data] of Object.entries(pending)) {
      if (!Array.isArray(data)) throw new Error("Invalid transaction journal.");
      await this.atomic(this.file(name), data);
    }
    await unlink(journal);
  }
  init() {
    return this.exclusive(async () => {
      await mkdir(this.directory, { recursive: true });
      await this.recover();
      for (const name of names) await this.readFile(name);
    });
  }
  transaction(work) {
    return this.exclusive(async () => {
      await this.recover();
      const records = {};
      for (const name of names) records[name] = await this.readFile(name);
      const before = JSON.stringify(records);
      const result = await work(records);
      if (before !== JSON.stringify(records)) {
        await this.atomic(path.join(this.directory, ".transaction.json"), records);
        await this.recover();
      }
      return structuredClone(result);
    });
  }
  readJson(name) {
    this.file(name);
    return this.transaction((data) => data[name]);
  }
  writeJson(name, value) {
    this.file(name);
    if (!Array.isArray(value)) throw new Error("JSON storage requires an array.");
    return this.transaction((data) => {
      data[name] = value;
      return value;
    });
  }
  findById(name, id) {
    return this.readJson(name).then((rows) => rows.find((row) => row.id === id));
  }
  insert(name, record) {
    this.file(name);
    return this.transaction((data) => {
      if (data[name].some((row) => row.id === record.id)) throw new Error("Duplicate record ID.");
      data[name].push(record);
      return record;
    });
  }
  update(name, id, changes) {
    this.file(name);
    return this.transaction((data) => {
      const record = data[name].find((row) => row.id === id);
      if (!record) throw new Error("Record not found.");
      Object.assign(record, changes, { id });
      return record;
    });
  }
  remove(name, id) {
    this.file(name);
    return this.transaction((data) => {
      data[name] = data[name].filter((row) => row.id !== id);
    });
  }
}
