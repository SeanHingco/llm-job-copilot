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

  const expiresLabel = premium?.active && premium?.expires_at
    ? new Date(premium.expires_at!).toLocaleDateString()
    : "—";

  return (
    <section
      className={[
        "rounded-3xl border border-white/10 bg-white/5 backdrop-blur",
        "p-5 md:p-7",
        className,
      ].join(" ")}
      aria-label="Referral"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-white">
          Invite friends, earn Premium
        </h2>
        <div
          className="shrink-0 rounded-full border border-white/20 px-2.5 py-1 text-xs font-medium text-white/80"
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
          className="w-full rounded-xl border border-white/10 bg-white/8 px-3.5 py-2.5 text-sm text-white placeholder-white/50 outline-none focus:border-white/30"
          placeholder="Your referral link"
        />
        <button
          type="button"
          onClick={onCopy}
          className="rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-sm font-medium text-white hover:bg-white/15 active:bg-white/20"
        >
          Copy
        </button>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="h-2 w-full rounded-full bg-white/15">
          <div
            className="h-2 rounded-full bg-indigo-500 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          />
        </div>
        <p className="mt-2 text-base md:text-sm text-white/80">
          {Math.max(goal - clamped, 0)} more = 1-month Premium 🚀
        </p>
      </div>

      {/* Info tiles */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/70">Template credits</div>
          <div className="mt-1 text-2xl font-semibold text-white">{templateCredits}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/70">Premium</div>
          <div className="mt-1 text-lg font-medium text-white/90">
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
        "border border-white/12 text-white",
        disabled
          ? "bg-white/5 text-white/40 cursor-not-allowed"
          : "bg-white/10 hover:bg-white/15 active:bg-white/20",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
