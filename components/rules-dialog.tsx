"use client";

import { useRef } from "react";
import styles from "./game.module.css";

const RULES = [
  "6덱을 씁니다. 슈가 비면 테이블 위의 카드를 빼고 다시 섞습니다.",
  "숫자 카드는 적힌 수, J·Q·K는 10, 에이스는 11 또는 1입니다. 21을 넘지 않으면 에이스는 11입니다.",
  "당신과 딜러가 두 장씩 받습니다. 딜러의 두 번째 카드는 덮여 있습니다.",
  "딜러 업카드가 에이스나 10이면 블랙잭인지 확인합니다. 딜러 블랙잭이면 그 판은 바로 끝납니다.",
  "처음 두 장으로 만든 21은 블랙잭이고 3:2입니다. 딜러도 블랙잭이면 푸시입니다.",
  "딜러가 에이스이고 당신이 블랙잭이 아니면, 베팅의 절반을 인슈어런스로 걸 수 있습니다. 적중하면 2:1입니다.",
  "당신이 블랙잭이고 딜러가 에이스면, 1:1 이븐 머니를 받거나 3:2를 노릴 수 있습니다.",
  "히트는 카드를 한 장 더 받습니다. 21을 넘으면 버스트로 지고, 딜러는 카드를 받지 않습니다.",
  "더블은 처음 두 장에서 같은 금액을 더 걸고 카드 한 장만 받습니다. 나눈 뒤에도 가능합니다.",
  "같은 랭크 두 장만 스플릿할 수 있습니다. 10과 J는 점수가 같아도 나눌 수 없습니다. 핸드는 4개까지입니다.",
  "에이스를 나누면 각 핸드에 카드 한 장만 받고 끝납니다. 그렇게 만든 21은 블랙잭이 아닙니다.",
  "서렌더는 나누지 않은 처음 두 장에서만 할 수 있고, 베팅의 절반을 돌려받습니다.",
  "딜러는 17 이상에서 멈추고, 소프트 17에서도 멈춥니다.",
  "최소 5, 최대 500입니다. 시작 잔고는 1,000이고, 5보다 적으면 칩을 다시 받습니다.",
];

export function RulesDialog() {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        className={`${styles.btn} ${styles.ghost}`}
        onClick={() => {
          if (dialog.current && !dialog.current.open) dialog.current.showModal();
        }}
      >
        규칙
      </button>
      <dialog ref={dialog} className={styles.dialog}>
        <form method="dialog">
          <div className={styles.dialogHead}>
            <h2>살롱 규칙</h2>
            <button type="submit" className={`${styles.btn} ${styles.primary}`}>
              닫기
            </button>
          </div>
          <p>키보드: H 히트, S 스탠드, D 더블, P 스플릿, U 서렌더, I 인슈어런스, E 이븐 머니, N 거절, Enter 딜.</p>
          <ul>
            {RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </form>
      </dialog>
    </>
  );
}
