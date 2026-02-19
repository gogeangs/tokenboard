import { internalErrorLog } from "@/lib/errors";

const TIMEOUT_MS = 5000;
const MAX_RETRIES = 1;

export async function sendWebhook(
  url: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (res.ok) return true;

      if (attempt < MAX_RETRIES) continue;
      internalErrorLog("webhook.send", new Error(`Webhook returned ${res.status}`));
      return false;
    } catch (error) {
      if (attempt < MAX_RETRIES) continue;
      internalErrorLog("webhook.send", error);
      return false;
    }
  }

  return false;
}
