"use client";
import { useState } from "react";

// types
type IngestOk = {
    status: string;
    url: string;
    final_url?: string;
    http_status: number;
    content_type: string;
    title: string;
    text_length: number;
    preview: string;
};

type IngestError = {
    detail?: string
};


export default function IngestPage() {
    const [url, setUrl] = useState("");
    const [result, setResult] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<IngestOk | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();

        // set state variables before fetching url
        setLoading(true);
        setError(null);
        setData(null);
        try {
            const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
            const res = await fetch(`${base}/ingest`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ url }),
            });
            // check for errors and retrieve available html response
            if (!res.ok) {
                const error: IngestError = await res.json().catch(() => ({}));
                setError(error.detail ?? `Request failed (${res.status})`)
            } else {
                const json: IngestOk = await res.json();
                setData(json);
            }
        } catch (error: any) {
            setError(`Error: ${error?.message ?? "Network error"}`);
        } finally {
            setLoading(false);
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
            {loading && (
                <div className="text-sm rounded p-3 border animate-pulse">working...</div>
            )}

            {error && (
                <div className="text-sm rounded p-3 border border-red-300 bg-red-50 text-red-800">
                    {error}
                </div>
            )}

            {data && (
                <div className="space-y-2 rounded p-3 border bg-gray-50">
                    <div className="text-sm text-gray-600">
                        <span className="font-medium">Title:</span> {data.title || "—"}
                    </div>
                    <div className="text-sm text-gray-600">
                        <span className="font-medium">Final URL:</span> {data.final_url || data.url}
                    </div>
                    <div className="text-sm text-gray-600">
                        <span className="font-medium">Text length:</span> {data.text_length}
                    </div>
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap">{data.preview}</pre>
                </div>
            )}
        </main>
    );
}