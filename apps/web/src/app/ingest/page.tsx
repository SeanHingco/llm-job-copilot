"use client";
import { useState } from "react";

export default function IngestPage() {
    const [url, setUrl] = useState("");
    const [result, setResult] = useState<string>("");

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setResult("working...");
        try {
            const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
            const res = await fetch(`${base}/ingest/url`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ url }),
            });
            const json = await res.json();
            setResult(JSON.stringify(json, null, 2));
        } catch (error: any) {
            setResult(`Error: ${error?.message ?? "Unknown error"}`);
        }
    }

    return (
        <main className="p-8 space y-4">
            <h1 className="text-2xl font-bold">Ingest Job</h1>
            <form onSubmit={onSubmit} className="flex gap-2">
                <input 
                    className="border rounded px-3 py-2 flex-1"
                    type="url"
                    placeholder="job URL"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                />
                <button className="bg-black text-white rounded px-4 py-2" type="submit">
                    Send
                </button>
            </form>
            <pre className="text-sm bg-gray-100 text-black rounded p-3 whitespace-pre-wrap">
                {result}
            </pre>
        </main>
    );
}