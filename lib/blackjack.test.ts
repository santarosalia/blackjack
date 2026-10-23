import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHIP_VALUES,
  MAX_BET,
  MIN_BET,
  STARTING_BANKROLL,
  type Card,
  type Rank,
  type Suit,
  actionsFor,
  createShoe,
  createState,
  handTotal,
  isNatural,
  reduce,
  visibleDealerTotal,
} from "./blackjack.ts";

let seq = 0;

function card(rank: Rank, suit: Suit = "spades"): Card {
  seq += 1;
  return { id: `t-${seq}`, rank, suit };
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function boot(
  cards: Card[],
  opts?: { bankroll?: number; wager?: number },
) {
  const wager = opts?.wager ?? 100;
  let state = createState({
    shoe: cards,
    bankroll: opts?.bankroll ?? STARTING_BANKROLL,
  });
  state = reduce(state, { type: "add-chip", amount: wager });
  state = reduce(state, { type: "deal" });
  return state;
}

test("카드 합: 에이스는 11 또는 1, 그림 카드는 10", () => {
  assert.deepEqual(handTotal([card("A"), card("K")]), { total: 21, soft: true });
  assert.deepEqual(handTotal([card("A"), card("6")]), { total: 17, soft: true });
  assert.deepEqual(handTotal([card("A"), card("6"), card("10")]), {
    total: 17,
    soft: false,
  });
  assert.deepEqual(handTotal([card("A"), card("A"), card("9")]), {
    total: 21,
    soft: true,
  });
  assert.deepEqual(handTotal([card("K"), card("Q")]), { total: 20, soft: false });
  assert.deepEqual(handTotal([card("10"), card("5"), card("7")]), {
    total: 22,
    soft: false,
  });
  assert.equal(isNatural([card("A"), card("J")]), true);
  assert.equal(isNatural([card("A"), card("K"), card("10")]), false);
  assert.equal(isNatural([card("10"), card("9")]), false);
});

test("6덱 슈는 312장이고 같은 시드면 같은 순서다", () => {
  const shoe = createShoe(mulberry32(1));
  assert.equal(shoe.length, 6 * 52);
  assert.equal(shoe.filter((c) => c.rank === "A").length, 24);
  assert.equal(new Set(shoe.map((c) => c.id)).size, shoe.length);
  const again = createShoe(mulberry32(1)).map((c) => c.id);
  assert.deepEqual(again, shoe.map((c) => c.id));
  assert.deepEqual(CHIP_VALUES, [5, 25, 100, 500]);
  assert.equal(MIN_BET, 5);
  assert.equal(MAX_BET, 500);
});

test("칩은 잔고와 최대 베팅을 넘지 않는다", () => {
  let state = createState({ shoe: [], bankroll: 40 });
  state = reduce(state, { type: "add-chip", amount: 25 });
  assert.equal(state.wager, 25);
  state = reduce(state, { type: "add-chip", amount: 25 });
  assert.equal(state.wager, 25);
  assert.match(state.message, /잔고/);

  let capped = createState({ shoe: [], bankroll: 1000 });
  capped = reduce(capped, { type: "add-chip", amount: 500 });
  capped = reduce(capped, { type: "add-chip", amount: 5 });
  assert.equal(capped.wager, 500);
  assert.match(capped.message, /500/);

  capped = reduce(capped, { type: "clear-wager" });
  assert.equal(capped.wager, 0);

  const ignored = reduce(capped, { type: "deal" });
  assert.equal(ignored.phase, "betting");
  assert.equal(ignored.hands.length, 0);
});

test("딜러 업카드가 10이고 플레이어만 블랙잭이면 3:2", () => {
  const state = boot([
    card("A"),
    card("9", "hearts"),
    card("K"),
    card("7", "diamonds"),
  ]);
  assert.equal(state.phase, "settlement");
  assert.equal(state.bankroll, 1150);
  assert.equal(state.hands[0].outcome, "blackjack");
  assert.equal(state.holeHidden, false);
  assert.equal(state.dealer.length, 2);
  assert.match(state.message, /블랙잭/);
});

test("양쪽 블랙잭이고 딜러 업카드가 10이면 푸시", () => {
  const state = boot([
    card("A"),
    card("K", "hearts"),
    card("K"),
    card("A", "diamonds"),
  ]);
  assert.equal(state.phase, "settlement");
  assert.equal(state.bankroll, 1000);
  assert.equal(state.hands[0].outcome, "push");
  assert.equal(state.holeHidden, false);
});

test("딜러 업카드가 10인 블랙잭이면 플레이어는 즉시 패배", () => {
  const state = boot([
    card("10"),
    card("K", "hearts"),
    card("8"),
    card("A", "diamonds"),
  ]);
  assert.equal(state.phase, "settlement");
  assert.equal(state.bankroll, 900);
  assert.equal(state.hands[0].outcome, "lose");
  assert.equal(state.holeHidden, false);
});

test("딜러 에이스면 인슈어런스를 묻고 홀카드는 숨긴다", () => {
  const state = boot([
    card("9"),
    card("A", "hearts"),
    card("8"),
    card("5", "diamonds"),
  ]);
  assert.equal(state.phase, "insurance");
  assert.equal(state.holeHidden, true);
  assert.equal(state.bankroll, 900);
  assert.equal(visibleDealerTotal(state.dealer, state.holeHidden).total, 11);
});

test("인슈어런스 적중은 2:1이고 본판은 잃는다", () => {
  let state = boot([
    card("9"),
    card("A", "hearts"),
    card("7"),
    card("K", "diamonds"),
  ]);
  state = reduce(state, { type: "insurance", take: true });
  assert.equal(state.phase, "settlement");
  assert.equal(state.insurance, 50);
  assert.equal(state.bankroll, 1000);
  assert.equal(state.hands[0].outcome, "lose");
  assert.equal(state.holeHidden, false);
});

test("잔고가 인슈어런스보다 적으면 거절되지 않고 그대로 둔다", () => {
  let state = boot(
    [card("9"), card("A", "hearts"), card("8"), card("5", "diamonds")],
    { bankroll: 120 },
  );
  assert.equal(state.bankroll, 20);
  state = reduce(state, { type: "insurance", take: true });
  assert.equal(state.phase, "insurance");
  assert.equal(state.bankroll, 20);
  assert.match(state.message, /잔고/);
});

test("인슈어런스를 거절하고 딜러 블랙잭이면 베팅을 잃는다", () => {
  let state = boot([
    card("9"),
    card("A", "hearts"),
    card("8"),
    card("K", "diamonds"),
  ]);
  state = reduce(state, { type: "insurance", take: false });
  assert.equal(state.phase, "settlement");
  assert.equal(state.bankroll, 900);
  assert.equal(state.hands[0].outcome, "lose");
});

test("인슈어런스가 빗나가면 플레이가 계속되고 소프트 17에서 딜러는 멈춘다", () => {
  let state = boot([
    card("10"),
    card("A", "hearts"),
    card("7"),
    card("6", "diamonds"),
  ]);
  state = reduce(state, { type: "insurance", take: true });
  assert.equal(state.phase, "player");
  assert.equal(state.bankroll, 850);
  assert.equal(state.holeHidden, true);
  state = reduce(state, { type: "stand" });
  assert.equal(state.phase, "dealer");
  state = reduce(state, { type: "dealer-step" });
  assert.equal(state.dealer.length, 2);
  assert.equal(state.phase, "settlement");
  assert.equal(state.hands[0].outcome, "push");
  assert.equal(state.bankroll, 950);
});

test("플레이어 블랙잭이고 딜러 에이스면 이븐 머니를 고른다", () => {
  const offered = boot([
    card("A"),
    card("A", "hearts"),
    card("K"),
    card("K", "diamonds"),
  ]);
  assert.equal(offered.phase, "even-money");

  const taken = reduce(offered, { type: "even-money", take: true });
  assert.equal(taken.phase, "settlement");
  assert.equal(taken.bankroll, 1100);
  assert.equal(taken.hands[0].outcome, "even-money");
  assert.match(taken.message, /이븐 머니/);

  const pushed = reduce(
    boot([
      card("A"),
      card("A", "hearts"),
      card("K"),
      card("Q", "diamonds"),
    ]),
    { type: "even-money", take: false },
  );
  assert.equal(pushed.bankroll, 1000);
  assert.equal(pushed.hands[0].outcome, "push");

  const paid = reduce(
    boot([
      card("A"),
      card("A", "hearts"),
      card("K"),
      card("5", "diamonds"),
    ]),
    { type: "even-money", take: false },
  );
  assert.equal(paid.bankroll, 1150);
  assert.equal(paid.hands[0].outcome, "blackjack");
});

test("버스트하면 딜러는 카드를 더 받지 않는다", () => {
  let state = boot([
    card("10"),
    card("9", "hearts"),
    card("6"),
    card("8", "diamonds"),
    card("K", "clubs"),
  ]);
  assert.equal(state.phase, "player");
  assert.equal(state.holeHidden, true);
  state = reduce(state, { type: "hit" });
  assert.equal(state.phase, "settlement");
  assert.equal(state.dealer.length, 2);
  assert.equal(state.hands[0].outcome, "bust");
  assert.equal(state.bankroll, 900);
  assert.equal(state.shoe.length, 0);
});

test("히트한 에이스는 버스트를 피하도록 1이 된다", () => {
  let state = boot([
    card("A"),
    card("9", "hearts"),
    card("5"),
    card("8", "diamonds"),
    card("10", "clubs"),
  ]);
  state = reduce(state, { type: "hit" });
  assert.equal(handTotal(state.hands[0].cards).total, 16);
  assert.equal(state.phase, "player");
  assert.equal(state.bankroll, 900);
});

test("21이 되면 자동으로 스탠드하고 딜러 차례로 넘긴다", () => {
  let state = boot([
    card("10"),
    card("9", "hearts"),
    card("5"),
    card("8", "diamonds"),
    card("6", "clubs"),
  ]);
  state = reduce(state, { type: "hit" });
  assert.equal(handTotal(state.hands[0].cards).total, 21);
  assert.equal(state.phase, "dealer");
});

test("딜러는 16에서 히트하고 17 이상이면 멈춘다", () => {
  let state = boot([
    card("10"),
    card("2", "hearts"),
    card("7"),
    card("3", "diamonds"),
    card("4", "clubs"),
    card("10", "hearts"),
  ]);
  state = reduce(state, { type: "stand" });
  state = reduce(state, { type: "dealer-step" });
  assert.equal(state.phase, "dealer");
  assert.equal(state.dealer.length, 3);
  assert.equal(handTotal(state.dealer).total, 9);
  state = reduce(state, { type: "dealer-step" });
  assert.equal(state.phase, "settlement");
  assert.equal(handTotal(state.dealer).total, 19);
  assert.equal(state.hands[0].outcome, "lose");
  assert.equal(state.bankroll, 900);
});

test("딜러 버스트면 플레이어가 1:1로 이긴다", () => {
  let state = boot([
    card("10"),
    card("6", "hearts"),
    card("8"),
    card("7", "diamonds"),
    card("K", "clubs"),
  ]);
  state = reduce(state, { type: "stand" });
  state = reduce(state, { type: "dealer-step" });
  assert.equal(state.dealer.length, 3);
  assert.equal(state.hands[0].outcome, "win");
  assert.equal(state.bankroll, 1100);
  assert.match(state.message, /딜러 버스트/);
});

test("더블은 한 장만 받고 베팅이 두 배가 된다", () => {
  let state = boot([
    card("5"),
    card("9", "hearts"),
    card("6"),
    card("7", "diamonds"),
    card("10", "clubs"),
    card("10", "hearts"),
  ]);
  assert.equal(actionsFor(state).double, true);
  state = reduce(state, { type: "double" });
  assert.equal(state.hands[0].cards.length, 3);
  assert.equal(state.hands[0].bet, 200);
  assert.equal(state.phase, "dealer");
  state = reduce(state, { type: "dealer-step" });
  assert.equal(handTotal(state.dealer).total, 26);
  assert.equal(state.bankroll, 1200);
});

test("잔고가 부족하면 더블할 수 없다", () => {
  const state = boot(
    [card("5"), card("9", "hearts"), card("6"), card("7", "diamonds")],
    { bankroll: 150 },
  );
  assert.equal(state.bankroll, 50);
  assert.equal(actionsFor(state).double, false);
  const next = reduce(state, { type: "double" });
  assert.equal(next.hands[0].cards.length, 2);
  assert.equal(next.bankroll, 50);
  assert.equal(next.phase, "player");
});

test("히트한 뒤에는 더블과 서렌더가 없다", () => {
  let state = boot([
    card("10"),
    card("9", "hearts"),
    card("2"),
    card("5", "diamonds"),
    card("3", "clubs"),
  ]);
  state = reduce(state, { type: "hit" });
  assert.equal(actionsFor(state).double, false);
  assert.equal(actionsFor(state).surrender, false);
  const kept = reduce(state, { type: "surrender" });
  assert.equal(kept.phase, "player");
  assert.equal(kept.hands[0].cards.length, 3);
});

test("서렌더는 베팅의 절반을 돌려주고 판을 끝낸다", () => {
  let state = boot([
    card("10"),
    card("10", "hearts"),
    card("6"),
    card("8", "diamonds"),
  ]);
  assert.equal(state.phase, "player");
  assert.equal(actionsFor(state).surrender, true);
  state = reduce(state, { type: "surrender" });
  assert.equal(state.phase, "settlement");
  assert.equal(state.bankroll, 950);
  assert.equal(state.hands[0].outcome, "surrender");
  assert.match(state.message, /서렌더/);
});

test("10과 잭은 랭크가 달라 스플릿되지 않고 잭 페어는 된다", () => {
  const mixed = boot([
    card("10"),
    card("9", "hearts"),
    card("J"),
    card("8", "diamonds"),
  ]);
  assert.equal(actionsFor(mixed).split, false);
  assert.equal(reduce(mixed, { type: "split" }).hands.length, 1);

  const jacks = boot([
    card("J"),
    card("9", "hearts"),
    card("J", "diamonds"),
    card("8", "clubs"),
    card("5"),
    card("5", "diamonds"),
  ]);
  assert.equal(actionsFor(jacks).split, true);
  const split = reduce(jacks, { type: "split" });
  assert.equal(split.hands.length, 2);
  assert.equal(split.bankroll, 800);
});

test("스플릿으로 만든 21은 블랙잭이 아니라 1:1이다", () => {
  let state = boot([
    card("10"),
    card("9", "hearts"),
    card("10", "diamonds"),
    card("8", "clubs"),
    card("A"),
    card("5", "diamonds"),
  ]);
  state = reduce(state, { type: "split" });
  assert.equal(state.hands[0].outcome, undefined);
  assert.equal(handTotal(state.hands[0].cards).total, 21);
  assert.equal(state.phase, "player");
  assert.equal(state.active, 1);
  state = reduce(state, { type: "stand" });
  assert.equal(state.phase, "dealer");
  state = reduce(state, { type: "dealer-step" });
  assert.equal(state.hands[0].outcome, "win");
  assert.notEqual(state.hands[0].outcome, "blackjack");
  assert.equal(state.hands[1].outcome, "lose");
  assert.equal(state.bankroll, 1000);
});

test("에이스 스플릿은 한 장씩만 받고 바로 딜러 차례다", () => {
  let state = boot([
    card("A"),
    card("9", "hearts"),
    card("A", "diamonds"),
    card("6", "clubs"),
    card("K"),
    card("9", "diamonds"),
    card("5", "clubs"),
  ]);
  state = reduce(state, { type: "split" });
  assert.equal(state.phase, "dealer");
  assert.equal(state.hands[0].splitAces, true);
  assert.equal(state.hands[1].cards.length, 2);
  assert.equal(actionsFor(state).hit, false);
  state = reduce(state, { type: "dealer-step" });
  assert.equal(handTotal(state.dealer).total, 20);
  assert.equal(state.hands[0].outcome, "win");
  assert.equal(state.hands[1].outcome, "push");
  assert.equal(state.bankroll, 1100);
});

test("같은 랭크는 최대 4핸드까지 다시 나눌 수 있다", () => {
  let state = boot([
    card("8"),
    card("6", "hearts"),
    card("8", "diamonds"),
    card("10", "clubs"),
    card("8", "clubs"),
    card("9"),
    card("8", "hearts"),
    card("4", "diamonds"),
    card("8", "spades"),
    card("2"),
    card("K"),
    card("3", "diamonds"),
  ]);
  state = reduce(state, { type: "split" });
  state = reduce(state, { type: "split" });
  state = reduce(state, { type: "split" });
  assert.equal(state.hands.length, 4);
  assert.equal(state.hands[0].cards[0].rank, "8");
  assert.equal(state.hands[0].cards[1].rank, "8");
  assert.equal(state.bankroll, 600);
  assert.equal(actionsFor(state).split, false);
  assert.equal(reduce(state, { type: "split" }).hands.length, 4);
});

test("스플릿 후에도 더블할 수 있고 서렌더는 없다", () => {
  let state = boot([
    card("5"),
    card("6", "hearts"),
    card("5", "diamonds"),
    card("10", "clubs"),
    card("4"),
    card("3", "diamonds"),
    card("K"),
    card("8", "clubs"),
  ]);
  state = reduce(state, { type: "split" });
  assert.equal(actionsFor(state).surrender, false);
  assert.equal(actionsFor(state).double, true);
  state = reduce(state, { type: "double" });
  assert.equal(state.hands[0].bet, 200);
  assert.equal(state.hands[0].cards.length, 3);
  assert.equal(state.active, 1);
  state = reduce(state, { type: "stand" });
  state = reduce(state, { type: "dealer-step" });
  assert.equal(handTotal(state.dealer).total, 24);
  assert.equal(state.bankroll, 1300);
});

test("플레이 중에는 홀카드를 세지 않는다", () => {
  const state = boot([
    card("10"),
    card("K", "hearts"),
    card("7"),
    card("5", "diamonds"),
  ]);
  assert.equal(visibleDealerTotal(state.dealer, true).total, 10);
  assert.equal(visibleDealerTotal(state.dealer, false).total, 15);
});

test("다음 판은 베팅으로 돌아가고 잔고가 없으면 칩을 다시 받는다", () => {
  let state = boot([
    card("10"),
    card("9", "hearts"),
    card("6"),
    card("8", "diamonds"),
    card("K"),
  ]);
  state = reduce(state, { type: "hit" });
  assert.equal(reduce(state, { type: "rebuy" }).bankroll, 900);
  state = reduce(state, { type: "next" });
  assert.equal(state.phase, "betting");
  assert.equal(state.hands.length, 0);
  assert.equal(state.dealer.length, 0);
  assert.equal(state.wager, 0);
  assert.equal(state.bankroll, 900);

  const rich = createState({ shoe: [], bankroll: 40 });
  assert.equal(reduce(rich, { type: "rebuy" }).bankroll, 40);
  let broke = createState({ shoe: [], bankroll: 0 });
  broke = reduce(broke, { type: "rebuy" });
  assert.equal(broke.bankroll, 1000);
  assert.match(broke.message, /1,000|1000/);
});

test("슈가 비어 있으면 딜할 때 다시 섞는다", () => {
  let state = createState({ shoe: [], bankroll: 1000 });
  state = reduce(state, { type: "add-chip", amount: 100 });
  state = reduce(state, { type: "deal" }, mulberry32(2));
  assert.equal(state.dealer.length, 2);
  assert.equal(state.hands[0].cards.length, 2);
  assert.equal(state.shoe.length, 312 - 4);
});

test("저장된 잔고는 베팅 중에만 되돌린다", () => {
  const state = createState({ shoe: [], bankroll: 1000 });
  const hydrated = reduce(state, { type: "hydrate", bankroll: 640 });
  assert.equal(hydrated.bankroll, 640);
  const mid = boot([
    card("10"),
    card("9", "hearts"),
    card("8"),
    card("7", "diamonds"),
  ]);
  assert.equal(reduce(mid, { type: "hydrate", bankroll: 1 }).bankroll, 900);
});
