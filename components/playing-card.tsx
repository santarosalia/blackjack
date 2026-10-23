"use client";

import { useEffect, useRef, type CSSProperties, type PointerEvent } from "react";
import type { Card, Rank, Suit } from "@/lib/blackjack";
import styles from "./game.module.css";

const RANK_NAME: Record<Rank, string> = {
  A: "에이스",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  "10": "10",
  J: "잭",
  Q: "퀸",
  K: "킹",
};

const SUIT_NAME: Record<Suit, string> = {
  spades: "스페이드",
  hearts: "하트",
  diamonds: "다이아몬드",
  clubs: "클럽",
};

const PIPS: Record<string, Array<[number, number, boolean]>> = {
  A: [[50, 48, false]],
  "2": [[50, 24, false], [50, 76, true]],
  "3": [[50, 22, false], [50, 48, false], [50, 78, true]],
  "4": [[32, 24, false], [68, 24, false], [32, 76, true], [68, 76, true]],
  "5": [[32, 24, false], [68, 24, false], [50, 48, false], [32, 76, true], [68, 76, true]],
  "6": [[32, 22, false], [68, 22, false], [32, 48, false], [68, 48, false], [32, 78, true], [68, 78, true]],
  "7": [[32, 18, false], [68, 18, false], [50, 34, false], [32, 50, false], [68, 50, false], [32, 80, true], [68, 80, true]],
  "8": [[32, 16, false], [68, 16, false], [50, 32, false], [32, 44, false], [68, 44, false], [32, 66, true], [68, 66, true], [50, 82, true]],
  "9": [[32, 16, false], [68, 16, false], [32, 34, false], [68, 34, false], [50, 48, false], [32, 64, true], [68, 64, true], [32, 82, true], [68, 82, true]],
  "10": [[32, 14, false], [68, 14, false], [50, 28, false], [32, 38, false], [68, 38, false], [32, 62, true], [68, 62, true], [50, 72, true], [32, 86, true], [68, 86, true]],
};

export function SuitMark({ suit }: { suit: Suit }) {
  if (suit === "clubs") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="7.1" r="3.5" />
        <circle cx="7.5" cy="13.1" r="3.5" />
        <circle cx="16.5" cy="13.1" r="3.5" />
        <path d="M10.3 13.4h3.4L15.2 21H8.8z" />
      </svg>
    );
  }

  const path = {
    spades:
      "M12 2.2c-1.4 2.6-6.2 6.4-6.2 10.4 0 2.7 2 4.7 4.5 4.7.5 0 .9-.1 1.2-.3.2 2.1.9 3.8 2.5 5.2 1.6-1.4 2.3-3.1 2.5-5.2.3.2.7.3 1.2.3 2.5 0 4.5-2 4.5-4.7C18.2 8.6 13.4 4.8 12 2.2z",
    hearts:
      "M12 20.4S5.2 16 5.2 11.2C5.2 8.8 7 7 9.2 7c1.3 0 2.3.6 2.8 1.6C12.5 7.6 13.5 7 14.8 7c2.2 0 4 1.8 4 4.2 0 4.8-6.8 9.2-6.8 9.2z",
    diamonds: "M12 2.4 20.6 12 12 21.6 3.4 12z",
  }[suit];

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

function Corner({ rank, suit, end = false }: { rank: Rank; suit: Suit; end?: boolean }) {
  return (
    <span className={end ? styles.cornerEnd : styles.corner} data-rank={rank}>
      <b>{rank}</b>
      <SuitMark suit={suit} />
    </span>
  );
}

function Face({ card }: { card: Card }) {
  const red = card.suit === "hearts" || card.suit === "diamonds";
  const court = card.rank === "J" || card.rank === "Q" || card.rank === "K";
  const pips = PIPS[card.rank] ?? [];

  return (
    <div className={red ? `${styles.face} ${styles.red}` : styles.face}>
      <Corner rank={card.rank} suit={card.suit} />
      {court ? (
        <div className={styles.court}>
          <SuitMark suit={card.suit} />
          <strong>{card.rank}</strong>
          <SuitMark suit={card.suit} />
        </div>
      ) : (
        <div className={styles.pips} data-rank={card.rank}>
          {pips.map(([x, y, turn]) => (
            <span
              key={`${x}-${y}`}
              className={styles.pip}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: `translate(-50%, -50%) rotate(${turn ? 180 : 0}deg)`,
              }}
            >
              <SuitMark suit={card.suit} />
            </span>
          ))}
        </div>
      )}
      <Corner rank={card.rank} suit={card.suit} end />
      <span className={styles.foil} />
      <span className={styles.glare} />
    </div>
  );
}

export function PlayingCard({
  card,
  down = false,
  index = 0,
}: {
  card: Card;
  down?: boolean;
  index?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 50, y: 32, on: 0 });
  const current = useRef({ x: 50, y: 32, on: 0 });
  const frame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function kick() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || frame.current) return;
    const step = () => {
      const el = ref.current;
      if (!el) return;
      const next = target.current;
      const now = current.current;
      now.x += (next.x - now.x) * 0.16;
      now.y += (next.y - now.y) * 0.16;
      now.on += (next.on - now.on) * 0.18;
      const dx = (now.x - 50) / 50;
      const dy = (now.y - 50) / 50;
      el.style.setProperty("--px", `${now.x}%`);
      el.style.setProperty("--py", `${now.y}%`);
      el.style.setProperty("--rx", `${(-dy * 11).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(dx * 13).toFixed(2)}deg`);
      el.style.setProperty("--bx", now.x.toFixed(2));
      el.style.setProperty("--by", now.y.toFixed(2));
      el.style.setProperty("--op", now.on.toFixed(3));
      const resting =
        Math.abs(next.x - now.x) < 0.08 &&
        Math.abs(next.y - now.y) < 0.08 &&
        Math.abs(next.on - now.on) < 0.012;
      frame.current = resting ? 0 : requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }

  function track(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    target.current.x = ((event.clientX - bounds.left) / bounds.width) * 100;
    target.current.y = ((event.clientY - bounds.top) / bounds.height) * 100;
    target.current.on = 1;
    kick();
  }

  function reset() {
    target.current = { x: 50, y: 32, on: 0 };
    kick();
  }

  const label = down
    ? "숨긴 카드"
    : `${SUIT_NAME[card.suit]} ${RANK_NAME[card.rank]}`;

  return (
    <div className={styles.slot} style={{ "--i": index } as CSSProperties}>
      <div
        ref={ref}
        className={down ? `${styles.card} ${styles.down}` : styles.card}
        onPointerMove={track}
        onPointerLeave={reset}
        onPointerCancel={reset}
        role="img"
        aria-label={label}
      >
        <div className={styles.tilt}>
          <div className={styles.flip}>
            {down ? null : <Face card={card} />}
            <div className={`${styles.back} ${styles.backArt}`}>
              <span className={styles.medallion}>
                <span className={styles.medallionMark}>21</span>
                <span className={styles.medallionSub}>SALON</span>
              </span>
              <span className={styles.foil} />
              <span className={styles.glare} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
