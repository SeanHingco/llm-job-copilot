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
    chunk_count?: number;
    selected_indices?: number[];
    context_chars?: number;
    context_preview?: string;
    query_used?: string;
};

type PydanticErrItem = { 
    type?: string;
    loc?: (string | number)[];
    msg?: string;
    input?: unknown };

type IngestError = {
    detail?: string | PydanticErrItem[]
};


export default function IngestPage() {
    const [url, setUrl] = useState("");
    const [q, setQ] = useState("");
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
            const body = q ? { url, q } : { url };
            const res = await fetch(`${base}/ingest`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify( body ),
            });
            // check for errors and retrieve available html response
            if (!res.ok) {
                let message = `Request failed (${res.status})`;
                try {
                    const error: IngestError = await res.json();
                    if (typeof error?.detail === "string") {
                        message = error.detail;
                    } else if (Array.isArray(error?.detail)) {
                        message = error.detail
                        .map((e) => {
                            const loc = Array.isArray(e.loc) ? e.loc.join(".") : String(e.loc ?? "body");
                            const msg = e.msg ?? e.type ?? "Invalid input";
                            return `${loc}: ${msg}`;
                        })
                        .join("; ");
                    }
                } catch {

                }
                setError(message);
                return;
            } else {
                const json: IngestOk = await res.json();
                setData(json);
            }
        } catch (error: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(`Error: ${msg ?? "Network error"}`);
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
                <input
                    className="border rounded px-3 py-2"
                    type="text"
                    placeholder='What are you looking for? e.g. "requirements responsibilities"'
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
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
                    <div className="text-sm text-gray-600">
                        <span className="font-medium">Chunks:</span> {(data).chunk_count ?? "—"}
                    </div>
                    {"selected_indices" in data && data.selected_indices && (
                        <div className="text-sm text-gray-700">
                            <span className="font-medium">Selected chunks:</span> [{data.selected_indices.join(", ")}]
                        </div>
                    )}
                    {"context_preview" in data && data.context_preview && (
                        <div>
                            <div className="text-sm font-medium text-gray-700 mb-1">Context preview:</div>
                            <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-white border rounded p-2">
                                {data.context_preview}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </main>
    );
}