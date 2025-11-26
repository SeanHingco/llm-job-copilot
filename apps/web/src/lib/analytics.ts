// lib/analytics.ts
import { v4 as uuidv4 } from "uuid";
import { apiFetch } from "@/lib/api";

const KEY = "rb:anon_id";

function getAnonId(): string {
  try {
    let v = localStorage.getItem(KEY);
    if (!v) {
      v = uuidv4();
      localStorage.setItem(KEY, v);
    }
    return v;
  } catch {
    return "anon-" + uuidv4();
  }
}

export async function capture(name: string, props: Record<string, unknown> = {}) {
  const anon_id = getAnonId();

  const body = {
    name,
    props,
    path: window.location.pathname,
    anon_id,
    client_event_id: uuidv4(),
  };

  // Use apiFetch so URL, headers, and CORS all match the rest of your app
  const res = await apiFetch<{ ok: boolean }>("/analytics/capture", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("[capture] sent", body, "got", res.status, res.data);
  }

  console.log("[capture] sent", body, "got", res.status, res.data);

  return res.data;
}
