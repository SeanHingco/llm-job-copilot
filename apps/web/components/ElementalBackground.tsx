"use client";

export function ElementalBackground() {
  return (
    <div className="elemental-bg">
      {/* SVG filter defs */}
      <svg width="0" height="0" aria-hidden="true" focusable="false">
        {/* DEFAULT */}
        <filter id="rb-flow-default">
          <feTurbulence type="fractalNoise" baseFrequency="0.010" numOctaves="2" seed="7" result="n">
            <animate attributeName="baseFrequency" dur="18s" values="0.010;0.012;0.010" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="18" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        {/* FIRE */}
        <filter id="rb-flow-fire">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="11" result="n">
            <animate attributeName="baseFrequency" dur="14s" values="0.012;0.016;0.012" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="24" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        {/* WATER */}
        <filter id="rb-flow-water">
          <feTurbulence type="fractalNoise" baseFrequency="0.009" numOctaves="2" seed="9" result="n">
            <animate attributeName="baseFrequency" dur="24s" values="0.009;0.011;0.009" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="16" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        {/* EARTH */}
        <filter id="rb-flow-earth">
          <feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves="2" seed="5" result="n">
            <animate attributeName="baseFrequency" dur="30s" values="0.008;0.009;0.008" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="12" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        {/* AIR */}
        <filter id="rb-flow-air">
          <feTurbulence type="fractalNoise" baseFrequency="0.010" numOctaves="2" seed="13" result="n">
            <animate attributeName="baseFrequency" dur="34s" values="0.010;0.012;0.010" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      <div className="elemental-spotlight" />

      {/* Blobs */}
      <div
        className="elemental-blob"
        style={{
          left: "-260px",
          top: "-260px",
          background: "radial-gradient(circle at 30% 30%, rgb(var(--b1) / 0.70), transparent 62%)",
          animationDelay: "0s",
        }}
      />
      <div
        className="elemental-blob"
        style={{
          right: "-320px",
          top: "8%",
          background: "radial-gradient(circle at 30% 30%, rgb(var(--b2) / 0.62), transparent 64%)",
          animationDelay: "-10s",
        }}
      />
      <div
        className="elemental-blob"
        style={{
          left: "12%",
          bottom: "-420px",
          background: "radial-gradient(circle at 30% 30%, rgb(var(--b3) / 0.55), transparent 66%)",
          animationDelay: "-18s",
        }}
      />

      {/* Flow overlay (animated via SVG filter + CSS drift) */}
      <div className="elemental-flow" />
    </div>
  );
}
