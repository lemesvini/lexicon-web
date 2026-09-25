import { useEffect, useRef, useState } from "react";

// Port of the "Advanced Context" Claude Design animation: two base blocks
// part, the Advanced Context block grows into the gap, holds, then retracts.
// Drawn as SVG in the reference's 766 × 834 coordinate space so it scales to
// whatever width the layout gives it.

const W = 766;
const H = 834;
const BLOCK_H = 218;
const ADV_H = 220;

// Scene cues (seconds): Hold 1.2 · Open 0.9 · Emerge 1.3 · Showcase 2.2 · Close 1.2
const OPEN = 1.2;
const EMERGE = 2.1;
const SHOWCASE = 3.4;
const CLOSE = 5.6;
const TOTAL = 6.8;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
const easeOutCubic = (t: number) => (t - 1) ** 3 + 1;
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  return 1 + (c1 + 1) * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

function ramp(t: number, start: number, end: number, ease: (t: number) => number) {
  if (t <= start) return 0;
  if (t >= end) return 1;
  return ease((t - start) / (end - start));
}

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

function useLoopTime() {
  const ref = useRef<SVGSVGElement>(null);
  // Reduced motion: hold on the fully-open frame.
  const [reduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [time, setTime] = useState(reduced ? SHOWCASE : 0);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    let frame = 0;
    let last = 0;
    // The first pass skips the opening hold so the blocks part as soon as the
    // animation scrolls into view; later loops keep the full cycle.
    let elapsed = OPEN;
    const tick = (now: number) => {
      if (last) elapsed = (elapsed + (now - last) / 1000) % TOTAL;
      last = now;
      setTime(elapsed);
      frame = requestAnimationFrame(tick);
    };

    // Only run while on screen — and not before a good part of it is, or the
    // first pass plays out below the fold.
    const observer = new IntersectionObserver(
      ([entry]) => {
        cancelAnimationFrame(frame);
        last = 0;
        if (entry.isIntersecting) frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [reduced]);

  return [ref, time] as const;
}

export function AdvancedContextAnim({ className }: { className?: string }) {
  const [ref, t] = useLoopTime();

  const open =
    ramp(t, OPEN, EMERGE, easeInOutCubic) -
    ramp(t, CLOSE + 0.3, TOTAL, easeInOutCubic);
  const emerge = Math.max(
    0,
    ramp(t, EMERGE - 0.25, EMERGE + 0.7, easeOutBack) -
      ramp(t, CLOSE, CLOSE + 0.45, easeOutCubic),
  );
  const label = Math.max(
    0,
    ramp(t, EMERGE + 0.3, EMERGE + 0.9, easeOutCubic) -
      ramp(t, CLOSE, CLOSE + 0.25, easeOutCubic),
  );
  const plus = Math.max(
    0,
    ramp(t, EMERGE + 0.6, EMERGE + 1.1, easeOutBack) -
      ramp(t, CLOSE, CLOSE + 0.25, easeOutCubic),
  );
  const cam =
    ramp(t, 0, CLOSE, easeInOutCubic) - ramp(t, CLOSE, TOTAL, easeInOutCubic);

  const topY = lerp(185, 57, open);
  const botY = lerp(431, 551, open);
  const panelTop = topY - 57;

  const baseBlock = (y: number) => (
    <g>
      <rect x={46} y={y} width={718} height={BLOCK_H} rx={28} fill="#82B59F" />
      <text
        x={78}
        y={y + 72}
        fill="#568C73"
        fontSize={42}
        fontWeight={600}
        style={{ fontFamily: "var(--font-montserrat)" }}
      >
        Conteúdo base
      </text>
    </g>
  );

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      style={{ overflow: "visible" }}
      role="img"
      aria-label="Bloco Advanced Context inserido entre dois blocos de conteúdo base"
    >
      <g
        transform={`translate(${W / 2} ${H / 2}) scale(${lerp(1, 1.04, cam)}) translate(${-W / 2} ${-H / 2})`}
      >
        <rect
          x={108}
          y={panelTop}
          width={594}
          height={botY + BLOCK_H + 65 - panelTop}
          rx={28}
          fill="#C2E0D5"
        />
        {baseBlock(topY)}
        {baseBlock(botY)}

        {emerge > 0.001 && (
          <g
            transform={`translate(405 413) scale(${lerp(0.55, 1, emerge)} ${lerp(0.08, 1, emerge)}) translate(-405 -413)`}
            opacity={Math.min(1, emerge * 3)}
          >
            <rect
              x={48}
              y={305}
              width={714}
              height={ADV_H - 4}
              rx={24}
              fill="#5FB495"
              stroke="#72DDB6"
              strokeWidth={4}
            />
            <text
              x={405}
              y={413 + lerp(14, 0, label)}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#E3F3EC"
              fontSize={54}
              opacity={label}
              style={{ fontFamily: "var(--font-display)" }}
            >
              Advanced Context
            </text>
          </g>
        )}

        {plus > 0 && (
          <g
            transform={`translate(45 328) scale(${plus}) rotate(${lerp(-90, 0, plus)})`}
          >
            <circle r={42} fill="#82B59F" stroke="#72DDB6" strokeWidth={4} />
            <rect x={-24} y={-4.5} width={48} height={9} rx={4.5} fill="#E3F3EC" />
            <rect x={-4.5} y={-24} width={9} height={48} rx={4.5} fill="#E3F3EC" />
          </g>
        )}
      </g>
    </svg>
  );
}
