import { Card, Rank, Suit } from '../shared/types/poker';
import { buildDeckForRule } from '../engine/deckEngine';

function scoreValue(rank: Rank): number {
  return rank >= 10 ? 10 : rank;
}

export function makeTutorialCard(suit: Suit, rank: Rank, tag: string): Card {
  return {
    id: `tutorial_${suit}_${rank}_${tag}`,
    suit,
    rank,
    quality: 'white',
    effects: [],
    baseValue: scoreValue(rank),
    multiplier: 0,
  };
}

/** 引导第 1 关首手五张（展示顺序） */
export const TUTORIAL_FIRST_HAND: Card[] = [
  makeTutorialCard('spades', 10, '0'),
  makeTutorialCard('hearts', 11, '1'),
  makeTutorialCard('clubs', 12, '2'),
  makeTutorialCard('diamonds', 13, '3'),
  makeTutorialCard('hearts', 7, '4'),
];

export const TUTORIAL_HOLD_INDICES = [0, 1, 2, 3] as const;

export const TUTORIAL_DRAW_CARD = makeTutorialCard('spades', 14, 'draw');

export const TUTORIAL_SKILL_ID = 'flat_mult';

export const HOME_TUTORIAL_LINES: Record<string, string[]> = {
  welcome_1: ['嘿，朋友！这里是——\n难-上-加-难的野人牌！'],
  welcome_2: ['我来告诉你基础规则\n注意：我只说一遍！'],
};

export const RUN_TUTORIAL_LINES: Record<string, string[]> = {
  hand_intro_1: ['5 张牌，按照牌型不同的倍率/分值，结算分数。'],
  hand_intro_2: ['对子、两对、三条、顺子……你懂的。'],
  hand_intro_3: ['你可以保留若干张，替换掉其他牌，追求更大的牌型。'],
  stage_clear: [], // 动态：本关目标达成，获得 💎N！
  shop_intro: ['用你的💎购买技能牌/升级牌/超级牌，让你的牌型更强！'],
  rules_extra_2: ['记住：保留/替换是关键，每手牌都可以使用不止一次。'],
  rules_extra_3: ['提醒：用好商店，胜利离你不会远。'],
};

/** 自动翻牌后等待动画再进入 hold（ms） */
export const AUTO_FLIP_DELAY_MS = 900;

const FIRST_HAND_SLOTS: { suit: Suit; rank: Rank }[] = [
  { suit: 'spades', rank: 10 },
  { suit: 'hearts', rank: 11 },
  { suit: 'clubs', rank: 12 },
  { suit: 'diamonds', rank: 13 },
  { suit: 'hearts', rank: 7 },
];

/** 引导首手发牌后的牌池（已去掉首手五张，♠A 在栈顶供补牌） */
export function buildTutorialDeckAfterFirstHand(): Card[] {
  const used = new Set(FIRST_HAND_SLOTS.map(({ suit, rank }) => `${suit}_${rank}`));
  const rest = buildDeckForRule('standard').filter((c) => !used.has(`${c.suit}_${c.rank}`));
  const aceIdx = rest.findIndex((c) => c.suit === 'spades' && c.rank === 14);
  if (aceIdx > 0) {
    const [ace] = rest.splice(aceIdx, 1);
    rest.unshift(ace);
  }
  return rest;
}
