export const MIN_BET = 5;
export const MAX_BET = 500;
export const STARTING_BANKROLL = 1000;
export const CHIP_VALUES = [5, 25, 100, 500] as const;

export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export type Outcome =
  | "blackjack"
  | "even-money"
  | "win"
  | "lose"
  | "push"
  | "bust"
  | "surrender";

export interface Hand {
  cards: Card[];
  bet: number;
  stood: boolean;
  doubled: boolean;
  surrendered: boolean;
  splitAces: boolean;
  outcome?: Outcome;
}

export type Phase =
  | "betting"
  | "insurance"
  | "even-money"
  | "player"
  | "dealer"
  | "settlement";

export interface State {
  phase: Phase;
  shoe: Card[];
  dealer: Card[];
  holeHidden: boolean;
  hands: Hand[];
  active: number;
  bankroll: number;
  wager: number;
  insurance: number;
  message: string;
  roundStart: number;
}

export type Action =
  | { type: "add-chip"; amount: number }
  | { type: "clear-wager" }
  | { type: "deal" }
  | { type: "insurance"; take: boolean }
  | { type: "even-money"; take: boolean }
  | { type: "hit" }
  | { type: "stand" }
  | { type: "double" }
  | { type: "split" }
  | { type: "surrender" }
  | { type: "dealer-step" }
  | { type: "next" }
  | { type: "rebuy" }
  | { type: "hydrate"; bankroll: number };

const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const RANKS: Rank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

const BET_PROMPT = "칩을 고르고 딜을 누르세요.";
const PLAY_PROMPT = "히트하거나 스탠드하세요.";

export function formatAmount(value: number): string {
  const amount = Math.abs(value);
  const [whole, fraction] = (
    Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(1)
  ).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${grouped}.${fraction}` : grouped;
}

export function signed(value: number): string {
  if (value > 0) return `+${formatAmount(value)}`;
  if (value < 0) return `−${formatAmount(value)}`;
  return "0";
}

export function handTotal(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === "A") {
      aces += 1;
      total += 11;
    } else if (card.rank === "J" || card.rank === "Q" || card.rank === "K") {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 };
}

export function isNatural(cards: Card[]): boolean {
  return cards.length === 2 && handTotal(cards).total === 21;
}

export function visibleDealerTotal(dealer: Card[], holeHidden: boolean) {
  return handTotal(holeHidden ? dealer.slice(0, 1) : dealer);
}

export function handNet(hand: Hand): number {
  switch (hand.outcome) {
    case "blackjack":
      return hand.bet * 1.5;
    case "even-money":
    case "win":
      return hand.bet;
    case "push":
      return 0;
    case "surrender":
      return -hand.bet / 2;
    case "lose":
    case "bust":
      return -hand.bet;
    default:
      return 0;
  }
}

export function createShoe(random: () => number = Math.random): Card[] {
  const cards: Card[] = [];
  for (let deck = 0; deck < 6; deck += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: `${deck}-${suit}-${rank}`, suit, rank });
      }
    }
  }
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = cards[i];
    cards[i] = cards[j];
    cards[j] = swap;
  }
  return cards;
}

export function createState(options?: {
  shoe?: Card[];
  bankroll?: number;
  random?: () => number;
}): State {
  const bankroll = options?.bankroll ?? STARTING_BANKROLL;
  return {
    phase: "betting",
    shoe: options?.shoe ?? createShoe(options?.random),
    dealer: [],
    holeHidden: false,
    hands: [],
    active: 0,
    bankroll,
    wager: 0,
    insurance: 0,
    message: BET_PROMPT,
    roundStart: bankroll,
  };
}

export function actionsFor(state: State) {
  const none = {
    hit: false,
    stand: false,
    double: false,
    split: false,
    surrender: false,
  };
  if (state.phase !== "player") return none;
  const hand = state.hands[state.active];
  if (!hand || hand.stood || hand.surrendered) return none;
  const total = handTotal(hand.cards).total;
  if (total > 21) return none;
  const twoCards = hand.cards.length === 2;
  const pair =
    twoCards && hand.cards[0].rank === hand.cards[1].rank && !hand.splitAces;
  return {
    hit: !hand.splitAces && total < 21,
    stand: true,
    double: twoCards && !hand.splitAces && state.bankroll >= hand.bet,
    split: pair && state.hands.length < 4 && state.bankroll >= hand.bet,
    surrender: twoCards && state.hands.length === 1 && !hand.doubled,
  };
}

export function reduce(
  state: State,
  action: Action,
  random: () => number = Math.random,
): State {
  switch (action.type) {
    case "add-chip":
      return addChip(state, action.amount);
    case "clear-wager":
      return state.phase === "betting"
        ? { ...state, wager: 0, message: BET_PROMPT }
        : state;
    case "deal":
      return deal(state, random);
    case "insurance":
      return insure(state, action.take);
    case "even-money":
      return evenMoney(state, action.take);
    case "hit":
      return hit(state, random);
    case "stand":
      return stand(state);
    case "double":
      return double(state, random);
    case "split":
      return split(state, random);
    case "surrender":
      return surrender(state);
    case "dealer-step":
      return dealerStep(state, random);
    case "next":
      return nextRound(state);
    case "rebuy":
      return rebuy(state);
    case "hydrate":
      return hydrate(state, action.bankroll);
    default:
      return state;
  }
}

function addChip(state: State, amount: number): State {
  if (state.phase !== "betting") return state;
  if (!(CHIP_VALUES as readonly number[]).includes(amount)) return state;
  const wager = state.wager + amount;
  if (wager > MAX_BET) {
    return { ...state, message: `최대 베팅은 ${formatAmount(MAX_BET)}입니다.` };
  }
  if (wager > state.bankroll) {
    return { ...state, message: "잔고가 부족합니다." };
  }
  return {
    ...state,
    wager,
    message: `베팅 ${formatAmount(wager)}. 딜을 누르면 카드가 나옵니다.`,
  };
}

function deal(state: State, random: () => number): State {
  if (state.phase !== "betting") return state;
  if (state.wager < MIN_BET) return { ...state, message: "칩을 먼저 거세요." };
  if (state.wager > state.bankroll) {
    return { ...state, message: "잔고가 부족합니다." };
  }

  let shoe = state.shoe;
  const drawn: Card[] = [];
  for (let i = 0; i < 4; i += 1) {
    const next = take(shoe, random, drawn);
    shoe = next.shoe;
    drawn.push(next.card);
  }

  const hand: Hand = {
    cards: [drawn[0], drawn[2]],
    bet: state.wager,
    stood: false,
    doubled: false,
    surrendered: false,
    splitAces: false,
  };
  return openTable({
    ...state,
    shoe,
    dealer: [drawn[1], drawn[3]],
    hands: [hand],
    active: 0,
    bankroll: state.bankroll - state.wager,
    insurance: 0,
    holeHidden: true,
    roundStart: state.bankroll,
  });
}

function openTable(state: State): State {
  const upcard = state.dealer[0];
  const playerNatural = isNatural(state.hands[0].cards);
  const dealerNatural = isNatural(state.dealer);
  if (upcard.rank === "A") {
    if (playerNatural) {
      return {
        ...state,
        phase: "even-money",
        message: "블랙잭입니다. 이븐 머니는 1:1로 바로 받습니다.",
      };
    }
    return {
      ...state,
      phase: "insurance",
      message: "딜러가 에이스입니다. 인슈어런스는 베팅의 절반, 적중하면 2:1입니다.",
    };
  }
  if (isTen(upcard) && dealerNatural) return finishDealerBlackjack(state);
  if (playerNatural) return payBlackjack(state);
  return { ...state, phase: "player", message: PLAY_PROMPT };
}

function insure(state: State, takeInsurance: boolean): State {
  const hand = state.hands[0];
  if (state.phase !== "insurance" || !hand) return state;
  if (!takeInsurance) return afterPeek(state);
  const cost = hand.bet / 2;
  if (state.bankroll < cost) return { ...state, message: "잔고가 부족합니다." };
  return afterPeek({
    ...state,
    bankroll: state.bankroll - cost,
    insurance: cost,
  });
}

function afterPeek(state: State): State {
  if (isNatural(state.dealer)) return finishDealerBlackjack(state);
  if (isNatural(state.hands[0].cards)) return payBlackjack(state);
  const missed = state.insurance > 0;
  return {
    ...state,
    phase: "player",
    holeHidden: true,
    message: missed
      ? "인슈어런스는 실패했습니다. 히트하거나 스탠드하세요."
      : PLAY_PROMPT,
  };
}

function evenMoney(state: State, takeIt: boolean): State {
  const hand = state.hands[0];
  if (state.phase !== "even-money" || !hand) return state;
  if (!takeIt) {
    return isNatural(state.dealer) ? finishDealerBlackjack(state) : payBlackjack(state);
  }
  const bet = hand.bet;
  return {
    ...state,
    bankroll: state.bankroll + bet * 2,
    phase: "settlement",
    holeHidden: false,
    hands: [{ ...hand, outcome: "even-money" }],
    message: `이븐 머니. ${signed(bet)}`,
  };
}

function hit(state: State, random: () => number): State {
  const hand = state.hands[state.active];
  if (!hand || !actionsFor(state).hit) return state;
  const drawn = take(state.shoe, random, cardsInPlay(state));
  const cards = [...hand.cards, drawn.card];
  const total = handTotal(cards).total;
  const hands = state.hands.slice();
  hands[state.active] = { ...hand, cards, stood: total === 21 };
  const next = { ...state, shoe: drawn.shoe, hands };
  if (total >= 21) return advance(next);
  return { ...next, phase: "player", message: PLAY_PROMPT };
}

function stand(state: State): State {
  const hand = state.hands[state.active];
  if (!hand || !actionsFor(state).stand) return state;
  const hands = state.hands.slice();
  hands[state.active] = { ...hand, stood: true };
  return advance({ ...state, hands });
}

function double(state: State, random: () => number): State {
  const hand = state.hands[state.active];
  if (!hand || !actionsFor(state).double) return state;
  const drawn = take(state.shoe, random, cardsInPlay(state));
  const hands = state.hands.slice();
  hands[state.active] = {
    ...hand,
    cards: [...hand.cards, drawn.card],
    bet: hand.bet * 2,
    doubled: true,
    stood: true,
  };
  return advance({
    ...state,
    shoe: drawn.shoe,
    hands,
    bankroll: state.bankroll - hand.bet,
  });
}

function split(state: State, random: () => number): State {
  const hand = state.hands[state.active];
  if (!hand || !actionsFor(state).split) return state;
  const [leftCard, rightCard] = hand.cards;
  const first = take(state.shoe, random, cardsInPlay(state));
  const second = take(first.shoe, random, [...cardsInPlay(state), first.card]);
  const aces = leftCard.rank === "A";
  const left: Hand = {
    cards: [leftCard, first.card],
    bet: hand.bet,
    stood: aces,
    doubled: false,
    surrendered: false,
    splitAces: aces,
  };
  const right: Hand = {
    cards: [rightCard, second.card],
    bet: hand.bet,
    stood: aces,
    doubled: false,
    surrendered: false,
    splitAces: aces,
  };
  const hands = state.hands.slice();
  hands.splice(state.active, 1, left, right);
  return advance({
    ...state,
    shoe: second.shoe,
    hands,
    bankroll: state.bankroll - hand.bet,
  });
}

function surrender(state: State): State {
  const hand = state.hands[state.active];
  if (!hand || !actionsFor(state).surrender) return state;
  const hands = state.hands.slice();
  hands[state.active] = { ...hand, surrendered: true, stood: true };
  return advance({ ...state, hands });
}

function dealerStep(state: State, random: () => number): State {
  if (state.phase !== "dealer") return state;
  if (!hasLiveHand(state.hands)) return settle(state);
  // S17: 소프트 17을 포함해 17 이상이면 딜러는 더 받지 않는다.
  if (handTotal(state.dealer).total >= 17) return settle(state);
  const drawn = take(state.shoe, random, cardsInPlay(state));
  const dealer = [...state.dealer, drawn.card];
  const next = { ...state, shoe: drawn.shoe, dealer };
  if (handTotal(dealer).total >= 17) return settle(next);
  return { ...next, phase: "dealer", message: "딜러가 카드를 뽑습니다." };
}

function nextRound(state: State): State {
  if (state.phase !== "settlement") return state;
  const broke = state.bankroll < MIN_BET;
  return {
    ...state,
    phase: "betting",
    dealer: [],
    hands: [],
    active: 0,
    holeHidden: false,
    insurance: 0,
    wager: 0,
    message: broke ? "잔고가 없습니다. 칩을 다시 받으세요." : BET_PROMPT,
  };
}

function rebuy(state: State): State {
  if (state.phase !== "betting" || state.bankroll >= MIN_BET) return state;
  return {
    ...state,
    bankroll: STARTING_BANKROLL,
    wager: 0,
    message: `칩 ${formatAmount(STARTING_BANKROLL)}을 다시 받았습니다.`,
  };
}

function hydrate(state: State, bankroll: number): State {
  if (state.phase !== "betting" || state.hands.length > 0) return state;
  if (!Number.isFinite(bankroll) || bankroll < 0) return state;
  return { ...state, bankroll: Math.min(Math.floor(bankroll), 1_000_000) };
}

function advance(state: State): State {
  const hands = state.hands.map((hand, index) => {
    if (index !== state.active) return hand;
    if (handTotal(hand.cards).total === 21) return { ...hand, stood: true };
    return hand;
  });
  for (let index = 0; index < hands.length; index += 1) {
    if (!isFinished(hands[index])) {
      return { ...state, hands, active: index, phase: "player", message: PLAY_PROMPT };
    }
  }
  if (hasLiveHand(hands)) {
    return { ...state, hands, phase: "dealer", message: "딜러가 카드를 뽑습니다." };
  }
  return settle({ ...state, hands });
}

function settle(state: State): State {
  const dealerTotal = handTotal(state.dealer).total;
  const dealerNatural = isNatural(state.dealer);
  let bankroll = state.bankroll;
  const hands = state.hands.map((hand) => {
    if (hand.outcome === "blackjack" || hand.outcome === "even-money") return hand;
    const total = handTotal(hand.cards).total;
    let outcome: Outcome;
    let returned = 0;
    if (hand.surrendered) {
      outcome = "surrender";
      returned = hand.bet / 2;
    } else if (total > 21) {
      outcome = "bust";
    } else if (dealerNatural) {
      outcome = "lose";
    } else if (dealerTotal > 21 || total > dealerTotal) {
      outcome = "win";
      returned = hand.bet * 2;
    } else if (total < dealerTotal) {
      outcome = "lose";
    } else {
      outcome = "push";
      returned = hand.bet;
    }
    bankroll += returned;
    return { ...hand, outcome };
  });
  if (state.insurance > 0 && dealerNatural) bankroll += state.insurance * 3;
  return {
    ...state,
    hands,
    bankroll,
    phase: "settlement",
    holeHidden: false,
    message: settlementMessage(state.dealer, hands, bankroll - state.roundStart),
  };
}

function finishDealerBlackjack(state: State): State {
  const playerNatural =
    state.hands.length === 1 && isNatural(state.hands[0].cards);
  let bankroll = state.bankroll;
  let hands: Hand[];
  if (playerNatural) {
    bankroll += state.hands[0].bet;
    hands = [{ ...state.hands[0], outcome: "push" }];
  } else {
    hands = state.hands.map((hand) => ({ ...hand, outcome: "lose" as const }));
  }
  if (state.insurance > 0) bankroll += state.insurance * 3;
  const net = bankroll - state.roundStart;
  let message = playerNatural ? "푸시. 베팅을 돌려받습니다." : `딜러 블랙잭. ${signed(net)}`;
  if (!playerNatural && state.insurance > 0 && net === 0) {
    message = "딜러 블랙잭. 인슈어런스로 본전입니다.";
  }
  if (!playerNatural && state.insurance > 0 && net > 0) {
    message = `딜러 블랙잭. 인슈어런스 ${signed(state.insurance * 2)}`;
  }
  return {
    ...state,
    bankroll,
    hands,
    phase: "settlement",
    holeHidden: false,
    message,
  };
}

function payBlackjack(state: State): State {
  const hand = state.hands[0];
  if (!hand) return state;
  const bet = hand.bet;
  return {
    ...state,
    bankroll: state.bankroll + bet * 2.5,
    phase: "settlement",
    holeHidden: false,
    hands: [{ ...hand, outcome: "blackjack" }],
    message: `블랙잭. ${signed(bet * 1.5)}`,
  };
}

function settlementMessage(dealer: Card[], hands: Hand[], net: number): string {
  if (hands.length > 1) return `정산 ${signed(net)}`;
  const outcome = hands[0]?.outcome;
  const dealerBust = handTotal(dealer).total > 21;
  if (outcome === "bust") return `버스트. ${signed(net)}`;
  if (outcome === "surrender") return `서렌더. ${signed(net)}`;
  if (outcome === "push") return "푸시. 베팅을 돌려받습니다.";
  if (outcome === "win" && dealerBust) return `딜러 버스트. ${signed(net)}`;
  if (outcome === "win") return `승리. ${signed(net)}`;
  if (outcome === "lose") return `패배. ${signed(net)}`;
  if (outcome === "blackjack") return `블랙잭. ${signed(net)}`;
  if (outcome === "even-money") return `이븐 머니. ${signed(net)}`;
  return `정산 ${signed(net)}`;
}

function isFinished(hand: Hand): boolean {
  if (hand.stood || hand.surrendered || hand.splitAces) return true;
  return handTotal(hand.cards).total >= 21;
}

function hasLiveHand(hands: Hand[]): boolean {
  return hands.some(
    (hand) => !hand.surrendered && handTotal(hand.cards).total <= 21,
  );
}

function cardsInPlay(state: State): Card[] {
  return [...state.dealer, ...state.hands.flatMap((hand) => hand.cards)];
}

function take(shoe: Card[], random: () => number, inPlay: Card[]) {
  const pile = shoe.length > 0 ? shoe : replenish(inPlay, random);
  const card = pile[0];
  if (!card) throw new Error("슈에 카드가 없습니다.");
  return { card, shoe: pile.slice(1) };
}

function replenish(inPlay: Card[], random: () => number): Card[] {
  const counts = new Map<string, number>();
  for (const card of inPlay) {
    const key = `${card.rank}:${card.suit}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const shoe: Card[] = [];
  for (const card of createShoe(random)) {
    const key = `${card.rank}:${card.suit}`;
    const left = counts.get(key) ?? 0;
    if (left > 0) {
      counts.set(key, left - 1);
      continue;
    }
    shoe.push(card);
  }
  return shoe;
}

function isTen(card: Card): boolean {
  return card.rank === "10" || card.rank === "J" || card.rank === "Q" || card.rank === "K";
}
