import adminConfig from "@/data/admin-config.json";

export type AdminConfig = {
  email: string;
  passwordHash: string;
};

const SESSION_KEY = "ledgerline.admin-session.v1";
const SESSION_EVENT = "ledgerline:admin-session";

export async function sha256(text: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(text).digest("hex");
}

export function getAdminConfig(): AdminConfig {
  return adminConfig as AdminConfig;
}

export async function verifyAdminLogin(email: string, password: string): Promise<boolean> {
  const config = getAdminConfig();
  const emailOk = email.trim().toLowerCase() === config.email.toLowerCase();
  if (!emailOk) return false;
  const hash = await sha256(password);
  return hash === config.passwordHash;
}

export function isAdminSession(): boolean {
  try {
    return localStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAdminSession(): void {
  try {
    localStorage.setItem(SESSION_KEY, "1");
    window.dispatchEvent(new Event(SESSION_EVENT));
  } catch {
    /* storage unavailable */
  }
}

export function clearAdminSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new Event(SESSION_EVENT));
  } catch {
    /* storage unavailable */
  }
}

export { SESSION_EVENT };
