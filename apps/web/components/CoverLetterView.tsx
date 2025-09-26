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

export default function CoverLetterView({ data }: { data: CoverJSON }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState<CoverJSON>(data);

  const plain = useMemo(() => coverToPlainText(local), [local]);

  function onCopy() {
    navigator.clipboard.writeText(plain).catch(() => {});
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
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-100 hover:text-slate-600"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "Done" : "Edit"}
        </button>
        <button
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-100 hover:text-slate-600"
          onClick={onCopy}
        >
          Copy
        </button>
        <button
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-100 hover:text-slate-600"
          onClick={onDownload}
        >
          Download .txt
        </button>
      </div>

      {/* View / Edit */}
      {editing ? (
        <div className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm">
          <label className="text-sm font-medium text-slate-600 ">
            Subject
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-600 text-sm"
              value={local.subject}
              onChange={(e) => setLocal({ ...local, subject: e.target.value })}
            />
          </label>

          <label className="text-sm font-medium text-slate-600 ">
            Greeting
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-600 text-sm"
              value={local.greeting}
              onChange={(e) => setLocal({ ...local, greeting: e.target.value })}
            />
          </label>

          <label className="text-sm font-medium text-slate-600 ">
            Body paragraphs (one per line)
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-600 text-sm"
              rows={6}
              value={local.body_paragraphs.join("\n")}
              onChange={(e) =>
                setLocal({ ...local, body_paragraphs: e.target.value.split("\n").filter(Boolean) })
              }
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-600">
              Valediction
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-600 text-sm"
                value={local.valediction}
                onChange={(e) => setLocal({ ...local, valediction: e.target.value })}
              />
            </label>
            <label className="text-sm font-medium text-slate-600">
              Signature
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-600 text-sm"
                value={local.signature}
                onChange={(e) => setLocal({ ...local, signature: e.target.value })}
              />
            </label>
          </div>
        </div>
      ) : (
        <article className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Subject</div>
          <h3 className="text-base font-semibold text-neutral-900">{local.subject}</h3>

          <div className="mt-4 space-y-4 text-neutral-800">
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
