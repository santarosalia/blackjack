"use client";

import { useEffect, useReducer, type CSSProperties } from "react";
import {
  CHIP_VALUES,
  MAX_BET,
  MIN_BET,
  type Card,
  type Hand,
  type Outcome,
  type State,
  actionsFor,
  createState,
  formatAmount,
  handNet,
  handTotal,
  reduce,
  signed,
  visibleDealerTotal,
} from "@/lib/blackjack";
import styles from "./game.module.css";
import { PlayingCard } from "./playing-card";
import { RulesDialog } from "./rules-dialog";

const OUTCOME_LABEL: Record<Outcome, string> = {
  blackjack: "블랙잭",
  "even-money": "이븐 머니",
  win: "승",
  lose: "패",
  push: "푸시",
  bust: "버스트",
  surrender: "서렌더",
};

function toneOf(state: State) {
  if (state.phase !== "settlement") return "idle";
  const net = state.bankroll - state.roundStart;
  if (net > 0) return "win";
  if (net < 0) return "lose";
  return "push";
}

function scoreLabel(cards: Card[], holeHidden = false) {
  const shown = holeHidden ? cards.slice(0, 1) : cards;
  if (shown.length === 0) return "";
  const value = holeHidden ? visibleDealerTotal(cards, true) : handTotal(cards);
  if (value.soft && shown.length > 1) return `소프트 ${value.total}`;
  return String(value.total);
}

function HandView({
  label,
  cards,
  holeHidden = false,
  bet,
  outcome,
  active = false,
}: {
  label: string;
  cards: Card[];
  holeHidden?: boolean;
  bet?: number;
  outcome?: Outcome;
  active?: boolean;
}) {
  const value = holeHidden ? visibleDealerTotal(cards, true) : handTotal(cards);
  const net =
    outcome && bet !== undefined
      ? handNet({
          cards,
          bet,
          stood: true,
          doubled: false,
          surrendered: outcome === "surrender",
          splitAces: false,
          outcome,
        })
      : 0;

  return (
    <article className={styles.hand} data-active={active ? "true" : "false"}>
      <div className={styles.handMeta}>
        <span className={styles.handName}>{label}</span>
        <span className={styles.total} data-bust={!holeHidden && value.total > 21 ? "true" : "false"}>
          {scoreLabel(cards, holeHidden)}
        </span>
        {bet !== undefined ? <span className={styles.bet}>베팅 {formatAmount(bet)}</span> : null}
      </div>
      <div className={styles.cards} style={{ "--count": Math.max(cards.length, 1) } as CSSProperties}>
        {cards.map((card, index) => (
          <PlayingCard key={card.id} card={card} down={holeHidden && index === 1} index={index} />
        ))}
      </div>
      {outcome ? (
        <p className={styles.outcome} data-kind={outcome}>
          {OUTCOME_LABEL[outcome]} {signed(net)}
        </p>
      ) : null}
    </article>
  );
}

export function Game() {
  const [state, dispatch] = useReducer(
    (current: State, action: Parameters<typeof reduce>[1]) => reduce(current, action),
    undefined,
    () => createState({ shoe: [] }),
  );
  const actions = actionsFor(state);
  const broke = state.phase === "betting" && state.bankroll < MIN_BET;

  useEffect(() => {
    if (state.phase !== "dealer") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => dispatch({ type: "dealer-step" }), reduced ? 0 : 520);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.dealer.length]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("dialog")) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (state.phase === "betting" && key === "enter" && state.wager >= MIN_BET) {
        event.preventDefault();
        dispatch({ type: "deal" });
      }
      if (state.phase === "betting" && key === "backspace") dispatch({ type: "clear-wager" });
      if (state.phase === "player") {
        if (key === "h" && actions.hit) dispatch({ type: "hit" });
        if (key === "s" && actions.stand) dispatch({ type: "stand" });
        if (key === "d" && actions.double) dispatch({ type: "double" });
        if (key === "p" && actions.split) dispatch({ type: "split" });
        if (key === "u" && actions.surrender) dispatch({ type: "surrender" });
      }
      if (state.phase === "insurance") {
        if (key === "i") dispatch({ type: "insurance", take: true });
        if (key === "n") dispatch({ type: "insurance", take: false });
      }
      if (state.phase === "even-money") {
        if (key === "e") dispatch({ type: "even-money", take: true });
        if (key === "n") dispatch({ type: "even-money", take: false });
      }
      if (state.phase === "settlement" && key === "enter") {
        event.preventDefault();
        dispatch({ type: "next" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, state.phase, state.wager]);

  return (
    <div className={styles.room}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <h1 className={styles.mark}>SALON</h1>
          <p className={styles.sub}>블랙잭 · 6덱 · 3:2 · 소프트 17 스탠드</p>
        </div>
        <p className={styles.bank}>
          <span>잔고</span>
          <strong>{formatAmount(state.bankroll)}</strong>
          {state.shoe.length > 0 ? <span>슈 {state.shoe.length}</span> : null}
        </p>
        <RulesDialog />
      </header>

      <main className={styles.table}>
        <section className={styles.felt} aria-label="블랙잭 테이블">
          <p className={styles.imprint} aria-hidden="true">
            BLACKJACK
          </p>
          <div className={styles.shoe} aria-hidden="true">
            <span className={styles.backArt} />
            <span className={styles.backArt} />
            <span className={styles.backArt} />
          </div>

          <div className={styles.zone}>
            {state.dealer.length > 0 ? (
              <HandView label="딜러" cards={state.dealer} holeHidden={state.holeHidden} />
            ) : (
              <p className={styles.seat}>딜러</p>
            )}
          </div>

          <p className={styles.message} data-tone={toneOf(state)} role="status">
            {state.message}
          </p>

          <div className={styles.zone}>
            {state.hands.length === 0 ? (
              <p className={styles.seat}>칩을 고르면 이 자리에 카드가 놓입니다.</p>
            ) : (
              <div className={styles.player}>
                {state.hands.map((hand, index) => (
                  <PlayerHand
                    key={hand.cards[0]?.id ?? index}
                    hand={hand}
                    index={index}
                    count={state.hands.length}
                    active={state.phase === "player" && state.active === index}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className={styles.dock}>
        {state.phase === "betting" ? (
          <Betting
            wager={state.wager}
            bankroll={state.bankroll}
            broke={broke}
            onChip={(amount) => dispatch({ type: "add-chip", amount })}
            onClear={() => dispatch({ type: "clear-wager" })}
            onDeal={() => dispatch({ type: "deal" })}
            onRebuy={() => dispatch({ type: "rebuy" })}
          />
        ) : null}

        {state.phase === "insurance" && state.hands[0] ? (
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.primary}`}
              onClick={() => dispatch({ type: "insurance", take: true })}
            >
              인슈어런스 {formatAmount(state.hands[0].bet / 2)}
            </button>
            <button type="button" className={styles.btn} onClick={() => dispatch({ type: "insurance", take: false })}>
              거절
            </button>
          </div>
        ) : null}

        {state.phase === "even-money" ? (
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.primary}`}
              onClick={() => dispatch({ type: "even-money", take: true })}
            >
              이븐 머니
            </button>
            <button type="button" className={styles.btn} onClick={() => dispatch({ type: "even-money", take: false })}>
              3:2 받기
            </button>
          </div>
        ) : null}

        {state.phase === "player" ? (
          <div className={styles.actions}>
            <button type="button" className={`${styles.btn} ${styles.primary}`} disabled={!actions.hit} onClick={() => dispatch({ type: "hit" })}>
              히트
            </button>
            <button type="button" className={styles.btn} disabled={!actions.stand} onClick={() => dispatch({ type: "stand" })}>
              스탠드
            </button>
            <button type="button" className={styles.btn} disabled={!actions.double} onClick={() => dispatch({ type: "double" })}>
              더블
            </button>
            <button type="button" className={styles.btn} disabled={!actions.split} onClick={() => dispatch({ type: "split" })}>
              스플릿
            </button>
            <button type="button" className={styles.btn} disabled={!actions.surrender} onClick={() => dispatch({ type: "surrender" })}>
              서렌더
            </button>
          </div>
        ) : null}

        {state.phase === "settlement" ? (
          <div className={styles.actions}>
            <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={() => dispatch({ type: "next" })}>
              다음 판
            </button>
          </div>
        ) : null}
      </footer>
    </div>
  );
}

function PlayerHand({
  hand,
  index,
  count,
  active,
}: {
  hand: Hand;
  index: number;
  count: number;
  active: boolean;
}) {
  return (
    <HandView
      label={count > 1 ? `핸드 ${index + 1}` : "나"}
      cards={hand.cards}
      bet={hand.bet}
      outcome={hand.outcome}
      active={active}
    />
  );
}

function Betting({
  wager,
  bankroll,
  broke,
  onChip,
  onClear,
  onDeal,
  onRebuy,
}: {
  wager: number;
  bankroll: number;
  broke: boolean;
  onChip: (amount: number) => void;
  onClear: () => void;
  onDeal: () => void;
  onRebuy: () => void;
}) {
  if (broke) {
    return (
      <div className={styles.actions}>
        <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={onRebuy}>
          칩 다시 받기
        </button>
      </div>
    );
  }

  return (
    <>
      <div className={styles.chips}>
        {CHIP_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            className={styles.chip}
            data-value={value}
            disabled={wager + value > MAX_BET || wager + value > bankroll}
            onClick={() => onChip(value)}
            aria-label={`${formatAmount(value)} 칩 추가`}
          >
            {formatAmount(value)}
          </button>
        ))}
      </div>
      <p className={styles.wager}>
        <span>베팅</span>
        <strong>{formatAmount(wager)}</strong>
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.btn} disabled={wager === 0} onClick={onClear}>
          비우기
        </button>
        <button type="button" className={`${styles.btn} ${styles.primary}`} disabled={wager < MIN_BET} onClick={onDeal}>
          딜
        </button>
      </div>
    </>
  );
}
