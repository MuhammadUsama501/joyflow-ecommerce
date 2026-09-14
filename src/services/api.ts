const baseUrl = (import.meta.env["VITE_API_URL"] || "http://localhost:5000").replace(/\/$/, "");
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(baseUrl + path, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
      signal: options.signal || AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error("The store could not be reached. Please try again shortly.");
  }
  const body = (await response.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    data?: T;
  } | null;
  if (!response.ok || !body?.success)
    throw new Error(body?.message || "The request could not be completed.");
  return body.data as T;
}
