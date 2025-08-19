import Image from "next/image";

// async function getHealth() {
//   try {
//     const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`, {
//       cache: "no-store",
//     });
//     return res.ok ? res.json() : { ok: false };
//   } catch {
//     return { ok: false };
//   }
// }

export default async function Home() {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  let health: { ok: boolean } = { ok: false };
  try {
    const res: Response = await fetch(`${base}/health`, { cache: "no-store" });
    health = res.ok ? await res.json() : { ok: false };
  } catch {
    health = { ok: false };
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Job Copilot</h1>
      <p className="mt-3">
        API Status: <span>{health?.ok ? "yup" : "nah"}</span>
      </p>
    </main>
  );
}
