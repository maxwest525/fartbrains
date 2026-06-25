import { useEffect, useState } from "react";

/**
 * Fixed-viewport gradient border glow that pulses for ~1.6s whenever an
 * "idea:created" CustomEvent fires on window. Pointer-events: none so it
 * never blocks UI. The actual visuals live in `.idea-burst` (index.css).
 */
export const IdeaCreatedFx = () => {
  const [pulses, setPulses] = useState<number[]>([]);

  useEffect(() => {
    const handler = () => {
      const id = Date.now() + Math.random();
      setPulses((p) => [...p, id]);
      // remove after animation completes
      window.setTimeout(() => {
        setPulses((p) => p.filter((x) => x !== id));
      }, 1800);
    };
    window.addEventListener("idea:created", handler);
    return () => window.removeEventListener("idea:created", handler);
  }, []);

  if (pulses.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {pulses.map((id) => (
        <div key={id} className="idea-burst absolute inset-0" />
      ))}
    </div>
  );
};
