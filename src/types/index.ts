// ===== スキル・エフェクト =====
export type SkillEffectType =
  | "hint"
  | "reduce_choices"
  | "heal_homeostasis"
  | "cleanse_debuff"
  | "reduce_penalty"
  | "time_extend"
  | "xp_boost"
  | "reduce_cd"
  | "safe_net"
  | "auto_highlight"
  | "buff_accuracy"
  | "show_related"
  | "mastery_boost"
  | "hot_heal"
  | "show_graph"
  | "skill_power_up";

export type SkillEffect = {
  type: SkillEffectType;
  value: number;
  duration?: number;
  condition?: string;
};

export type Skill = {
  id: string;
  name: string;
  type: "active" | "ultimate" | "passive";
  cooldown: number;
  chargeRequired?: number;
  learnCostMp?: number;
  description: string;
  effects: SkillEffect[];
};

export type PassiveSkill = Skill & { type: "passive" };
export type UltimateSkill = Skill & { type: "ultimate"; chargeRequired: number };

// ===== デバフ =====
export type DebuffType =
  | "observation_miss"
  | "misinformation"
  | "time_pressure"
  | "equipment_malfunction";

export type Debuff = {
  type: DebuffType;
  duration: number;
  severity: number;
};

// ===== キャラクター =====
export type HeroId = "minato" | "hikari" | "kotoha" | "leon";

export type BattleStats = {
  atk: number;
  def: number;
  spd: number;
};

export type Hero = {
  id: HeroId;
  name: string;
  profession: string;
  concept: string;
  themeColor: string;
  themeColorClass: string;
  baseStats: BattleStats;
  skills: Skill[];
  passive: Skill;
  ultimate: Skill;
  evolutionLine: string[];
  learnableSkills?: Skill[];
  imageUrl?: string;
};

export type TeamCombo = {
  id: string;
  name: string;
  requiredHeroes: string[];
  effects: SkillEffect[];
  description: string;
};

// ===== クイズ =====
export type QuizFormat =
  | "multiple_choice"
  | "fill_blank"
  | "speed"
  | "sort"
  | "true_false";

export type QuizType = "mini" | "confirm" | "final";

export type Question = {
  id: string;
  chapter: number;
  type: QuizType;
  format: QuizFormat;
  question: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  blanks?: { position: number; answer: string; options: string[] }[];
  sortAnswer?: number[];
  relatedOrgan?: string;
  keywords?: string[];
  timeLimit?: number;
};

// ===== カード =====
export type CardRarity = "Common" | "Rare" | "Epic" | "Legend";
export type CardCategory = "organelle" | "organ" | "system";

export type Card = {
  id: string;
  name: string;
  category: CardCategory;
  rarity: CardRarity;
  chapter: number;
  evolutionLine: string[];
  skins: string[];
  attackPower: number;
  attribute: string;
  description: string;
  imageUrl?: string;
};

// ===== 仲間 =====
export type CompanionType = "nurse" | "researcher" | "guardian" | "hero";

export type Companion = {
  id: string;
  name: string;
  heroRef?: HeroId;
  type: CompanionType;
  rarity: CardRarity;
  level: number;
  exp: number;
  baseStats: { hp: number } & BattleStats;
  skills: Skill[];
  evolutionLine: string[];
  evolutionStage: number;
  imageUrl?: string;
};

// ===== アイテム =====
export type ItemType = "consumable" | "enhance" | "cure" | "collection";

export type Item = {
  id: string;
  name: string;
  type: ItemType;
  effect: string;
  rarity: "Common" | "Rare" | "Epic";
  description: string;
  cost?: number;
  imageUrl?: string;
};

// ===== ボス =====
export type Boss = {
  id: string;
  chapter: number;
  name: string;
  hp: number;
  debuffPattern: Debuff[];
  weakness: string;
  rewards: { cardId?: string; mp: number; items: string[] };
  storyIntro: string;
  imageUrl?: string;
};

// ===== 実績 =====
export type Achievement = {
  id: string;
  name: string;
  description: string;
  condition: string;
  secretFlag: boolean;
  reward: { type: string; value: string };
  imageUrl?: string;
};

// ===== ストーリー =====
export type StoryScene = {
  id: string;
  chapter: number;
  timing: "game_start" | "hero_intro" | "intro" | "pre_boss" | "post_boss" | "ending";
  heroVariant?: HeroId;
  dialogue: { speaker: string; text: string; emotion?: string }[];
};

// ===== デイリーミッション =====
export type DailyMissionTemplate = {
  id: string;
  description: string;
  condition: DailyMissionCondition;
  reward: { mp: number; itemId?: string };
};

export type DailyMissionCondition =
  | "quiz_play_1"
  | "quiz_play_3"
  | "streak_3"
  | "streak_5"
  | "skill_use_2"
  | "skill_use_3"
  | "boss_challenge"
  | "card_capture_1"
  | "card_capture_3"
  | "companion_gain"
  | "item_use_1"
  | "perfect_quiz"
  | "chapter_clear";

export type ActiveDailyMission = {
  templateId: string;
  description: string;
  condition: DailyMissionCondition;
  reward: { mp: number; itemId?: string };
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
};

export type DailyState = {
  lastLoginDate: string;
  loginStreak: number;
  loginBonusClaimed: boolean;
  loginBonusDay: number;
  missions: ActiveDailyMission[];
  missionsDate: string;
};

export type LoginBonusReward = {
  day: number;
  type: "mp" | "item" | "card" | "companion";
  value: string;
  amount: number;
  label: string;
};

// ===== カードスキン =====
export type CardSkinId = "normal" | "pastel" | "sparkle" | "pixel";

// Legacy alias
export type DailyMission = DailyMissionTemplate;

// ===== ショップ =====
export type ShopItem = {
  id: string;
  itemId: string;
  pointCost: number;
  stock: number;
  weeklyOnly?: boolean;
};

// ===== ユーザーデータ =====
export type ChapterProgress = {
  unlocked: boolean;
  mastery: number;
  bossDefeated: boolean;
  miniQuizBest: number;
  confirmQuizBest: number;
  reviewCount: number;
};

export type OwnedCard = {
  stage: number;
  count: number;
  skin: string;
};

export type UserCurrentRun = {
  selectedHeroId: HeroId;
  playerName: string;
  team: Companion[];
  battleFormationIds?: string[];
  level: number;
  totalXP: number;
  mp: number;
  learnedSkillIds?: string[];
  equippedSkillIds?: string[];
  homeostasis: number;
  debuffs: Debuff[];
  skillCooldowns: Record<string, number>;
  ultimateCharge: number;
  chapterProgress: Record<number, ChapterProgress>;
  ownedCards: Record<string, OwnedCard>;
  ownedCompanions: Companion[];
  ownedItems: Record<string, number>;
  fragments: number;
  captureEnergy: number;
  wrongAnswers: string[];
  streak: number;
  activeBuffs: ActiveBuff[];
};

export type ActiveBuff = {
  type: string;
  value: number;
  turnsRemaining: number;
};

export type UserCollection = {
  cards: Record<string, OwnedCard>;
  companions: Companion[];
  items: Record<string, number>;
  bosses: Record<string, { defeated: boolean; bestTime?: number }>;
  heroes: Record<string, { used: boolean; maxStage: number }>;
  completionRate: number;
  passwordUnlocked: boolean;
  password?: string;
};

export type UserMeta = {
  totalClears: number;
  achievements: Record<string, boolean>;
  titles: string[];
  activeTitle: string;
  cardSkins: string[];
  loginStreak: number;
  lastLoginDate: string;
  externalPasswords: string[];
  specialGameUnlocked: boolean;
};

// ===== ゲーム状態 =====
export type GameScreen =
  | "title"
  | "hero_select"
  | "player_name"
  | "home"
  | "chapter_map"
  | "team_edit"
  | "quiz"
  | "battle"
  | "result"
  | "battle_result"
  | "zukan"
  | "shop"
  | "profile"
  | "settings"
  | "story"
  | "daily_bonus";

export type QuizResult = {
  chapter: number;
  total: number;
  correct: number;
  wrong: number;
  maxStreak: number;
  wrongQuestionIds: string[];
  timeTaken: number;
  questionsAnswered: { questionId: string; correct: boolean; timeMs: number }[];
};

export type Difficulty = "easy" | "normal" | "hard";
