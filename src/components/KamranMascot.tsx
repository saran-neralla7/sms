"use client";

import { useRef, useState, useEffect } from "react";

// 3x3 layout of directions in sprite sheet
const DIRECTIONS_GRID = [
  "up-left", "up", "up-right",
  "left", "center", "right",
  "down-left", "down", "down-right"
];

// 3x3 layout of reactions in sprite sheet
const REACTIONS_GRID = [
  "blink", "heart", "sparkle",
  "surprised", "wink", "bashful",
  "sleepy", "dizzy", "delighted"
];

// Clockwise mapping of angles around the circle
const ANGLE_DIRECTIONS = [
  "right",
  "down-right",
  "down",
  "down-left",
  "left",
  "up-left",
  "up",
  "up-right"
];

const SECTOR_ANGLE = (Math.PI * 2) / ANGLE_DIRECTIONS.length;
const HYSTERESIS = 0.12;
const DEAD_ZONE_RADIUS = 70; // px threshold for "center" look
const COMBO_REACTIONS = ["heart", "sparkle", "delighted"];

function getBackgroundPosition(index: number) {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return `${col * 50}% ${row * 50}%`;
}

function normalizeAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

interface KamranMascotProps {
  size?: number;
  className?: string;
  onClick?: () => void;
  isIdle?: boolean;
}

export default function KamranMascot({
  size,
  className = "",
  onClick,
  isIdle = false
}: KamranMascotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const characterRef = useRef<HTMLSpanElement>(null);
  const timersRef = useRef<number[]>([]);
  const clickTrackerRef = useRef({ count: 0, at: 0 });

  const [direction, setDirection] = useState<string>("center");
  const [reaction, setReaction] = useState<string | null>(null);

  // Mouse & Scroll tracking
  useEffect(() => {
    // Only track if hover is supported
    if (typeof window === "undefined" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return;
    }

    let lastSector = -1;
    let pointerPos: { x: number; y: number } | null = null;

    const updateDirection = () => {
      const el = containerRef.current;
      if (!el || !pointerPos) return;

      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = pointerPos.x - centerX;
      const dy = pointerPos.y - centerY;

      // When cursor is within dead-zone, look straight center
      if (Math.hypot(dx, dy) < DEAD_ZONE_RADIUS) {
        lastSector = -1;
        setDirection("center");
        return;
      }

      const angle = Math.atan2(dy, dx);

      // Dead-band hysteresis to prevent flickering on angle boundaries
      if (
        lastSector !== -1 &&
        Math.abs(normalizeAngle(angle - lastSector * SECTOR_ANGLE)) <
          SECTOR_ANGLE / 2 + HYSTERESIS
      ) {
        return;
      }

      const newSector =
        (Math.round(angle / SECTOR_ANGLE) + ANGLE_DIRECTIONS.length) %
        ANGLE_DIRECTIONS.length;
      lastSector = newSector;
      setDirection(ANGLE_DIRECTIONS[newSector]);
    };

    const onPointerMove = (e: PointerEvent) => {
      pointerPos = { x: e.clientX, y: e.clientY };
      updateDirection();
    };

    const onScroll = () => {
      updateDirection();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(window.clearTimeout);
    };
  }, []);

  // Periodic blinking during idle state
  useEffect(() => {
    if (!isIdle || reaction) return;

    const blinkInterval = setInterval(() => {
      setReaction("blink");
      const t = window.setTimeout(() => {
        setReaction(null);
      }, 350);
      timersRef.current.push(t);
    }, 4500 + Math.random() * 2000);

    return () => clearInterval(blinkInterval);
  }, [isIdle, reaction]);

  const triggerPokeReaction = () => {
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];

    const schedule = (delay: number, r: string | null) => {
      timersRef.current.push(window.setTimeout(() => setReaction(r), delay));
    };

    const now = Date.now();
    const tracker = clickTrackerRef.current;
    tracker.count = now - tracker.at < 1600 ? tracker.count + 1 : 1;
    tracker.at = now;

    if (tracker.count >= 4) {
      // Combo dizzy reaction
      tracker.count = 0;
      setReaction("dizzy");
      schedule(1100, null);
    } else {
      // Normal boop reaction
      setReaction("blink");
      const nextReaction = COMBO_REACTIONS[(tracker.count - 1) % COMBO_REACTIONS.length];
      schedule(120, nextReaction);
      schedule(560, null);
    }

    // Squash & stretch boop bounce
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && characterRef.current) {
      characterRef.current.animate(
        [
          { transform: "scale(1, 1)", easing: "ease-in" },
          { transform: "scale(1.10, 0.86)", offset: 0.18, easing: "ease-out" },
          { transform: "scale(0.95, 1.08)", offset: 0.45, easing: "ease-in-out" },
          { transform: "scale(1.03, 0.97)", offset: 0.72, easing: "ease-in-out" },
          { transform: "scale(1, 1)" }
        ],
        { duration: 420, easing: "linear" }
      );
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    triggerPokeReaction();
    if (onClick) onClick();
  };

  const spriteStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundSize: "300% 300%",
    backgroundRepeat: "no-repeat"
  };

  const dirIndex = DIRECTIONS_GRID.indexOf(direction);
  const reactIndex = REACTIONS_GRID.indexOf(reaction ?? "blink");

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label="Kamran Mascot"
      className={`relative select-none ${className}`}
      style={{
        display: "block",
        flexShrink: 0,
        width: size ? size : undefined,
        height: size ? size : undefined,
        padding: 0,
        border: 0,
        background: "transparent",
        userSelect: "none"
      }}
    >
      <span
        ref={characterRef}
        style={{
          position: "relative",
          display: "block",
          width: "100%",
          height: "100%",
          transformOrigin: "50% 78%"
        }}
      >
        {/* Directions Sprite (Active when no click reaction) */}
        <span
          style={{
            ...spriteStyle,
            backgroundImage: "url(/mascots/kamran-directions.webp)",
            backgroundPosition: getBackgroundPosition(dirIndex !== -1 ? dirIndex : 4),
            opacity: reaction ? 0 : 1,
            transition: "opacity 60ms linear"
          }}
        />

        {/* Reaction Sprite (Active when poked/blinking) */}
        <span
          style={{
            ...spriteStyle,
            backgroundImage: "url(/mascots/kamran-reactions.webp)",
            backgroundPosition: getBackgroundPosition(reactIndex !== -1 ? reactIndex : 0),
            opacity: reaction ? 1 : 0,
            transition: "opacity 60ms linear"
          }}
        />
      </span>
    </div>
  );
}
