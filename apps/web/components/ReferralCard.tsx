import { useMemo } from "react";

type Props = {
  referralUrl: string;
  referredCount: number;   // 0..n
  goal: number;            // e.g. 3
  premium?: { active: boolean; expires_at?: string | null };
  templateCredits?: number;
  onCopy?: () => void;
  onQuickShare?: () => void;
  onShareLinkedIn?: () => void;
  onShareEmail?: () => void;
  onShareSMS?: () => void;
  className?: string;
};

export default function ReferralCard({
  referralUrl,
  referredCount,
  goal,
  premium,
  templateCredits = 0,
  onCopy,
  onQuickShare,
  onShareLinkedIn,
  onShareEmail,
  onShareSMS,
  className = "",
}: Props) {
  const clamped = Math.min(referredCount, goal);
  const pct = useMemo(() => Math.round((clamped / Math.max(goal, 1)) * 100), [clamped, goal]);

  const hasUnlocked = referredCount >= goal;
  const remaining = Math.max(0, goal - referredCount);

  const expiresLabel = premium?.active && premium?.expires_at
    ? new Date(premium.expires_at!).toLocaleDateString()
    : "—";

  return (
    <section
      className={[
        "rounded-3xl border bg-background/5 backdrop-blur",
        "p-5 md:p-7",
        className,
      ].join(" ")}
      aria-label="Referral"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
            Like Resume Bender? Invite friends, become an Early Contributor!
          </h2>

          {hasUnlocked && (
            <span className="inline-flex items-center rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-medium text-emerald-100 border border-emerald-300/40">
              Early Contributor
            </span>
          )}
        </div>

        <div
          className="shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium text-foreground/80"
          aria-label={`Progress ${clamped}/${goal}`}
        >
          {clamped}/{goal}
        </div>
      </div>

      {/* Link + Copy */}
      <div className="mt-4 flex gap-3">
        <input
          readOnly
          value={referralUrl}
          className="w-full rounded-xl border bg-background/8 px-3.5 py-2.5 text-sm text-foreground placeholder-foreground/50 outline-none focus:border-ring/30"
          placeholder="Your referral link"
        />
        <button
          type="button"
          onClick={onCopy}
          className="rounded-xl border bg-background/90 px-3.5 py-2.5 text-sm font-medium text-foreground hover:bg-muted/90 active:bg-background"
        >
          Copy
        </button>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="h-2 w-full rounded-full bg-background/15">
          <div
            className="h-2 rounded-full bg-indigo-500 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          />
        </div>
        <p className="mt-2 text-base md:text-sm text-foreground/80">
          {hasUnlocked
            ? "You’ve unlocked the Early Contributor badge. Thanks for supporting Resume Bender early ❤️"
            : `${remaining} more = Early Contributor badge`}
        </p>
      </div>

      {/* Info tiles */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-border/90 bg-background/5 p-4">
          <div className="text-sm text-foreground/70">Template credits</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{templateCredits}</div>
        </div>
        <div className="rounded-2xl border border-border/90 bg-background/90 p-4">
          <div className="text-sm text-foreground/70">Premium</div>
          <div className="mt-1 text-lg font-medium text-foreground/90">
            {premium?.active ? `Active until ${expiresLabel}` : "Not active"}
          </div>
        </div>
      </div>

      {/* Share buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        <SmallBtn label="Quick Share" onClick={onQuickShare} />
        <SmallBtn label="LinkedIn" onClick={onShareLinkedIn} />
        <SmallBtn label="Email" onClick={onShareEmail} />
        <SmallBtn label="SMS" onClick={onShareSMS} />
      </div>
    </section>
  );
}

function SmallBtn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "h-10 rounded-xl px-3.5 text-sm font-medium",
        "border border-foreground text-foreground",
        disabled
          ? "bg-background/10 text-foreground/40 cursor-not-allowed"
          : "bg-background/5 hover:bg-foreground/15 active:bg-foreground/20",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
