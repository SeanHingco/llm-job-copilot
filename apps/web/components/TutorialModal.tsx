"use client";
import { useEffect } from "react";

type Props = { open: boolean; onClose: () => void };

export default function TutorialModal({ open, onClose }: Props) {
  // close on ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* modal */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl text-neutral-500 font-semibold mb-1">Quick tour</h2>
        <p className="text-sm text-neutral-600 mb-4">
          Paste a job (URL or text), pick tasks, and get tailored outputs. v2 adds richer JSON with evidence.
        </p>

        <ol className="list-decimal pl-5 space-y-2 text-sm text-neutral-800">
          <li><strong>Job input:</strong> paste description or URL. If both, we prioritize pasted text.</li>
          <li><strong>Tasks:</strong> Select one or more task. Each task costs one credit. Hover over each task for more info.</li>
          <li><strong>Context:</strong> Add a job title & resume text for better alignment.</li>
          <li><strong>View:</strong> Look at resume or cover letter advice.</li>
        </ol>

        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={() => {
              localStorage.setItem("rb:tutorial_seen", "1");
              onClose();
            }}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Got it
          </button>
          <button
            onClick={onClose}
            className="text-sm text-neutral-600 hover:underline"
          >
            Remind me later
          </button>
        </div>
      </div>
    </div>
  );
}
