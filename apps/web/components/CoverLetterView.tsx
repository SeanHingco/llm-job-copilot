"use client";

import { useMemo, useState } from "react";

export type CoverJSON = {
  subject: string;
  greeting: string;
  body_paragraphs: string[];
  valediction: string;
  signature: string;
};

function coverToPlainText(d: CoverJSON): string {
  return [
    d.subject,
    "",
    d.greeting,
    "",
    ...d.body_paragraphs,
    "",
    d.valediction,
    d.signature,
  ].join("\n");
}

// Extract JSON from markdown code blocks
function extractJsonFromMarkdown(s: string): unknown | null {
  // strip ```lang … ``` and grab the first {...} block
  const fenceMatch = s.match(/```[\s\S]*?```/);
  const inner = fenceMatch ? fenceMatch[0] : s;

  // remove the ```lang\n prefix and closing ```
  const withoutFences = inner
    .replace(/^```[a-zA-Z]*\s*\n?/, "")
    .replace(/```$/, "")
    .trim();

  // get tightest outer braces
  const first = withoutFences.indexOf("{");
  const last = withoutFences.lastIndexOf("}");
  const candidate = first >= 0 && last > first
    ? withoutFences.slice(first, last + 1)
    : withoutFences;

  try { return JSON.parse(candidate); } catch { return null; }
}

export default function CoverLetterView({ 
  data, 
  showResetWarning = false 
}: { 
  data: CoverJSON | string | { bullets: string };
  showResetWarning?: boolean;
}) {
  // Normalize string/V1 input to CoverJSON-like structure for editing
  const initialData: CoverJSON = useMemo(() => {
    if (typeof data === "string") {
      // Try to parse as JSON first (might be markdown-wrapped JSON)
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(data);
      } catch {
        // If direct parse fails, try extracting from markdown
        parsed = extractJsonFromMarkdown(data);
      }
      
      // If we successfully parsed JSON and it looks like a cover letter
      if (parsed && typeof parsed === "object" && parsed !== null) {
        const p = parsed as Record<string, unknown>;
        if ("subject" in p && "body_paragraphs" in p) {
          return {
            subject: typeof p.subject === "string" ? p.subject : "",
            greeting: typeof p.greeting === "string" ? p.greeting : "",
            body_paragraphs: Array.isArray(p.body_paragraphs) ? p.body_paragraphs.filter((item): item is string => typeof item === "string") : [],
            valediction: typeof p.valediction === "string" ? p.valediction : "",
            signature: typeof p.signature === "string" ? p.signature : "",
          };
        }
      }
      
      // If not JSON, treat as plain text
      return { subject: "Cover Letter", greeting: "", body_paragraphs: data.split("\n"), valediction: "", signature: "" };
    }
    if (typeof data === "object" && data !== null && "bullets" in data) {
      const bullets = (data as { bullets: unknown }).bullets;
      if (typeof bullets === "string") {
        // Try to parse as JSON first
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(bullets);
        } catch {
          parsed = extractJsonFromMarkdown(bullets);
        }
        
        if (parsed && typeof parsed === "object" && parsed !== null) {
          const p = parsed as Record<string, unknown>;
          if ("subject" in p && "body_paragraphs" in p) {
            return {
              subject: typeof p.subject === "string" ? p.subject : "",
              greeting: typeof p.greeting === "string" ? p.greeting : "",
              body_paragraphs: Array.isArray(p.body_paragraphs) ? p.body_paragraphs.filter((item): item is string => typeof item === "string") : [],
              valediction: typeof p.valediction === "string" ? p.valediction : "",
              signature: typeof p.signature === "string" ? p.signature : "",
            };
          }
        }
        
        // If not JSON, treat as plain text
        return { subject: "Cover Letter", greeting: "", body_paragraphs: bullets.split("\n"), valediction: "", signature: "" };
      }
    }
    // Fallback if data doesn't match expected shape (e.g. valid JSON)
    const d = data as CoverJSON;
    return {
      subject: d.subject || "",
      greeting: d.greeting || "",
      body_paragraphs: d.body_paragraphs || [],
      valediction: d.valediction || "",
      signature: d.signature || "",
    };
  }, [data]);

  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState<CoverJSON>(initialData);

  const plain = useMemo(() => coverToPlainText(local), [local]);

  function onCopy() {
    navigator.clipboard.writeText(plain).catch(() => { });
  }

  function onDownload() {
    const blob = new Blob([plain], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cover-letter.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:bg-muted"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "Done" : showResetWarning ? "Edit (Resets on Refresh!)" : "Edit"}
        </button>
        <button
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:bg-muted"
          onClick={onCopy}
        >
          Copy
        </button>
        <button
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:bg-muted"
          onClick={onDownload}
        >
          Download .txt
        </button>
      </div>

      {/* View / Edit */}
      {editing ? (
        <div className="grid gap-3 rounded-xl border bg-background p-4 shadow-sm">
          <label className="text-sm font-medium text-foreground">
            Subject
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm"
              value={local.subject}
              onChange={(e) => setLocal({ ...local, subject: e.target.value })}
            />
          </label>

          <label className="text-sm font-medium text-foreground ">
            Greeting
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm"
              value={local.greeting}
              onChange={(e) => setLocal({ ...local, greeting: e.target.value })}
            />
          </label>

          <label className="text-sm font-medium text-muted-foreground ">
            Body paragraphs (one per line)
            <textarea
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm"
              rows={6}
              value={local.body_paragraphs.join("\n")}
              onChange={(e) =>
                setLocal({ ...local, body_paragraphs: e.target.value.split("\n").filter(Boolean) })
              }
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-muted-foreground">
              Valediction
              <input
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm"
                value={local.valediction}
                onChange={(e) => setLocal({ ...local, valediction: e.target.value })}
              />
            </label>
            <label className="text-sm font-medium text-muted-foreground">
              Signature
              <input
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm"
                value={local.signature}
                onChange={(e) => setLocal({ ...local, signature: e.target.value })}
              />
            </label>
          </div>
        </div>
      ) : (
        <article className="rounded-xl border bg-background p-6 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Subject</div>
          <h3 className="text-base font-semibold text-foreground">{local.subject}</h3>

          <div className="mt-4 space-y-4 text-foreground">
            <p>{local.greeting}</p>
            {local.body_paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <p className="mt-2">{local.valediction}</p>
            <p>{local.signature}</p>
          </div>
        </article>
      )}
    </div>
  );
}
