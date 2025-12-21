"use client";
import { ReactNode } from "react";

type V2Bullet = {
  text: string;
  job_chunks?: number[];
  evidence?: string;
  keywords?: string[];
  rationale?: string;
  transferable?: boolean;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(x => typeof x === "string");
}
function isNumberArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every(x => typeof x === "number");
}
function isV2Bullet(v: unknown): v is V2Bullet {
  if (!isObject(v) || typeof v.text !== "string") return false;
  if (v.job_chunks !== undefined && !isNumberArray(v.job_chunks)) return false;
  if (v.evidence !== undefined && typeof v.evidence !== "string") return false;
  if (v.keywords !== undefined && !isStringArray(v.keywords)) return false;
  if (v.rationale !== undefined && typeof v.rationale !== "string") return false;
  if (v.transferable !== undefined && typeof v.transferable !== "boolean") return false;
  return true;
}

export default function BulletsView({ data }: { data: unknown }): ReactNode | null {
  // Expecting { bullets: V2Bullet[] }
  if (!isObject(data)) return null;
  const bulletsUnknown = (data as Record<string, unknown>)["bullets"];
  if (!Array.isArray(bulletsUnknown)) return null;

  // If *none* of the items look like v2 (with extra fields), bail so caller can fallback to plain text.
  const hasV2Hints = bulletsUnknown.some(b =>
    isObject(b) && ("evidence" in b || "keywords" in b || "rationale" in b || "transferable" in b)
  );
  if (!hasV2Hints) return null;

  const bullets = bulletsUnknown.filter(isV2Bullet);
  if (bullets.length === 0) return null;

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(bullets.map(b => `• ${b.text}`).join("\n"));
    } catch {}
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={copyAll}
          className="rounded-md border px-2 py-1 bg-background text-xs text-foreground hover:bg-muted"
          aria-label="Copy all bullets"
        >
          Copy all
        </button>
      </div>

      {bullets.map((b, i) => (
        <article key={i} className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-2">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-background" />
            <div className="flex-1">
              <h3 className="font-medium text-foreground">{b.text}</h3>

              {/* sub details */}
              {(b.evidence || b.rationale) && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {b.evidence && <><span className="font-medium">evidence:</span> {b.evidence}</>}
                  {b.evidence && b.rationale ? " • " : ""}
                  {b.rationale && <><span className="font-medium">why:</span> {b.rationale}</>}
                </p>
              )}

              {/* chips */}
              {(b.keywords?.length || b.job_chunks?.length || b.transferable) && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {b.keywords?.map((k, idx) => (
                    <span key={idx} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground border border-border">
                      {k}
                    </span>
                  ))}
                  {b.job_chunks?.length ? (
                    <span className="rounded-full bg-info/10 px-2 py-0.5 text-[11px] text-info border border-info/20">
                      refs: [{b.job_chunks.join(",")}]
                    </span>
                  ) : null}
                  {b.transferable ? (
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] text-success border border-success/20">
                      transferable
                    </span>
                  ) : null}
                </div>
              )}
            </div>
            {/* per-card copy */}
            <button
              type="button"
              onClick={async () => {
                try { await navigator.clipboard.writeText(b.text); } catch {}
              }}
              className="ml-2 rounded-md border px-2 py-1 text-xs text-foreground hover:bg-foreground/10"
              aria-label="Copy bullet"
              title="Copy bullet"
            >
              Copy
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
