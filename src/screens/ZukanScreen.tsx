import { useState } from "react";
import { useGameStore } from "../stores/gameStore";
import { useMetaStore } from "../stores/metaStore";
import { useCollectionStore } from "../stores/collectionStore";
import { ScreenLayout, GlassCard, Badge, Modal, PastelButton } from "../components/common";
import type { Card, Item, Boss, CardSkinId, Companion, OwnedCard } from "../types";
import cardsData from "../data/cards.json";
import itemsData from "../data/items.json";
import bossesData from "../data/bosses.json";
import heroesData from "../data/heroes.json";

const allCards = cardsData as Card[];
const allItems = itemsData as Item[];
const allBosses = bossesData as Boss[];
const heroes = heroesData as {
  id: string;
  name: string;
  profession: string;
  themeColor: string;
  evolutionLine: string[];
  imageUrl?: string;
}[];

type Tab = "cards" | "companions" | "items" | "bosses" | "heroes";

const MAX_PAGES_PER_TAB = 3;
const MIN_PAGE_SIZE: Record<Tab, number> = {
  cards: 12,
  companions: 3,
  items: 4,
  bosses: 3,
  heroes: 2,
};

const skinStyles: Record<CardSkinId, { border: string; bg: string; label: string }> = {
  normal: { border: "border-gray-200", bg: "", label: "ノーマル" },
  pastel: {
    border: "border-pink-300",
    bg: "bg-gradient-to-br from-pastel-pink/10 to-lavender/10",
    label: "パステル",
  },
  sparkle: {
    border: "border-amber-300",
    bg: "bg-gradient-to-br from-pastel-yellow/20 to-white",
    label: "キラキラ",
  },
  pixel: {
    border: "border-sky-300",
    bg: "bg-[repeating-conic-gradient(#f0f0f0_0%_25%,#fff_0%_50%)_0_0/8px_8px]",
    label: "ドット絵",
  },
};

const rarityColor: Record<string, string> = {
  Common: "#98d4bb",
  Rare: "#b8a9c9",
  Epic: "#f08080",
  Legend: "#ffd700",
};
const categoryEmoji: Record<string, string> = { organelle: "🧫", organ: "🫀", system: "🔗" };
const typeEmoji: Record<string, string> = { nurse: "💉", researcher: "🔬", guardian: "🛡️", hero: "⭐" };
const itemTypeEmoji: Record<string, string> = { consumable: "🧪", enhance: "⬆️", cure: "💊", collection: "🎨" };
const heroAvatars: Record<string, string> = { minato: "👩‍⚕️", hikari: "🔬", kotoha: "🌿", leon: "💻" };

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "cards", label: "カード", emoji: "🃏" },
  { id: "companions", label: "仲間", emoji: "👥" },
  { id: "items", label: "アイテム", emoji: "🎒" },
  { id: "bosses", label: "ボス", emoji: "👹" },
  { id: "heroes", label: "主人公", emoji: "⭐" },
];

const INITIAL_TAB_PAGE: Record<Tab, number> = {
  cards: 0,
  companions: 0,
  items: 0,
  bosses: 0,
  heroes: 0,
};

export default function ZukanScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const currentRun = useGameStore((s) => s.currentRun);
  const updateCard = useGameStore((s) => s.updateCard);
  const meta = useMetaStore((s) => s.meta);
  const collection = useCollectionStore((s) => s.collection);
  const [tab, setTab] = useState<Tab>("cards");
  const [tabPage, setTabPage] = useState<Record<Tab, number>>(INITIAL_TAB_PAGE);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showSkinPicker, setShowSkinPicker] = useState(false);

  if (!currentRun) return null;

  const mergedCards = mergeOwnedCards(collection.cards, currentRun.ownedCards);
  const mergedCompanions = mergeCompanions(collection.companions, currentRun.ownedCompanions);
  const mergedItems = mergeItems(collection.items, currentRun.ownedItems);
  const ownedCardIds = Object.keys(mergedCards);
  const cardRate = Math.round((ownedCardIds.length / allCards.length) * 100);

  const counts: Record<Tab, number> = {
    cards: allCards.length,
    companions: mergedCompanions.length,
    items: allItems.length,
    bosses: allBosses.length,
    heroes: heroes.length,
  };

  const currentPageSize = Math.max(
    MIN_PAGE_SIZE[tab],
    Math.ceil(Math.max(counts[tab], 1) / MAX_PAGES_PER_TAB)
  );
  const totalPages = Math.max(1, Math.ceil(counts[tab] / currentPageSize));
  const clampedPage = Math.min(tabPage[tab], totalPages - 1);
  const pageStart = clampedPage * currentPageSize;

  const selectedCard = selectedCardId
    ? allCards.find((card) => card.id === selectedCardId) ?? null
    : null;
  const selectedOwnedCard = selectedCard ? mergedCards[selectedCard.id] : undefined;
  const canEditSelectedSkin = selectedCard ? !!currentRun.ownedCards[selectedCard.id] : false;

  const handleChangeSkin = (cardId: string, skin: CardSkinId) => {
    const existing = currentRun.ownedCards[cardId];
    if (!existing) return;
    updateCard(cardId, { ...existing, skin });
    setShowSkinPicker(false);
  };

  const updateCurrentTabPage = (next: number) => {
    setTabPage((prev) => ({ ...prev, [tab]: next }));
  };

  const renderPageSlots = <T,>(
    items: T[],
    pageSize: number,
    renderItem: (item: T, index: number) => React.JSX.Element,
    emptyLabel: string
  ) => {
    const missingCount = Math.max(0, pageSize - items.length);
    return (
      <>
        {items.map((item, index) => renderItem(item, index))}
        {Array.from({ length: missingCount }).map((_, index) => (
          <div
            key={`empty-${index}`}
            className="rounded-xl border-2 border-dashed border-white/55 bg-white/20 grid place-items-center text-[11px] text-warm-gray/30"
          >
            {emptyLabel}
          </div>
        ))}
      </>
    );
  };

  return (
    <ScreenLayout bgImage="/orgamon-quest/images/backgrounds/zukan_bg.webp"
      onBack={() => setScreen("home")}
      title="図鑑"
      titleEmoji="📚"
      padding="compact"
      className="min-h-[100dvh] flex flex-col pb-[calc(env(safe-area-inset-bottom)+0.25rem)]"
    >
      <div className="flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
        <div className="flex gap-2 shrink-0">
          <GlassCard variant="strong" className="flex-1 p-2 text-center">
            <p className="text-[9px] text-warm-gray/40">カード</p>
            <p className="text-sm font-bold text-warm-gray">{cardRate}%</p>
          </GlassCard>
          <GlassCard className="flex-1 p-2 text-center !bg-pastel-green/15">
            <p className="text-[9px] text-warm-gray/40">全体コンプ</p>
            <p className="text-sm font-bold text-green-700">{collection.completionRate}%</p>
          </GlassCard>
        </div>

        <div className="grid grid-cols-5 gap-1 bg-white/40 rounded-xl p-1 shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setSelectedCardId(null);
                setShowSkinPicker(false);
              }}
              className={`min-h-11 text-[10px] font-medium rounded-lg transition-all ${tab === t.id
                ? "glass-strong shadow-sm text-warm-gray"
                : "text-warm-gray/45 hover:text-warm-gray/70"
                }`}
            >
              <div className="leading-none mb-0.5">{t.emoji}</div>
              <div className="leading-none">{t.label}</div>
            </button>
          ))}
        </div>

        <GlassCard variant="strong" className="flex-1 min-h-0 p-3 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <p className="text-xs font-bold text-warm-gray">
              {TABS.find((entry) => entry.id === tab)?.emoji} {TABS.find((entry) => entry.id === tab)?.label}
            </p>
            <p className="text-[11px] text-warm-gray/45">
              {counts[tab] === 0 ? "0件" : `${pageStart + 1}-${Math.min(counts[tab], pageStart + currentPageSize)}/${counts[tab]}`}
            </p>
          </div>

          {tab === "cards" && (
            (() => {
              const visibleCards = allCards.slice(pageStart, pageStart + currentPageSize);
              const columns = 3;
              const rows = Math.ceil(currentPageSize / columns);
              const emptyCount = Math.max(0, currentPageSize - visibleCards.length);

              return (
                <div
                  className="flex-1 min-h-0 grid grid-cols-3 gap-1.5"
                  style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
                >
                  {visibleCards.map((card) => {
                    const owned = mergedCards[card.id];
                    const isOwned = !!owned;
                    return (
                      <button
                        key={card.id}
                        onClick={() => {
                          setSelectedCardId(card.id);
                          setShowSkinPicker(false);
                        }}
                        className={`rounded-lg border px-1.5 py-1 text-center transition-all flex flex-col justify-between ${isOwned
                          ? "bg-white/72 border-white/80 hover:bg-white/90 btn-press"
                          : "bg-gray-100/55 border-white/65 opacity-55"
                          }`}
                      >
                        <div
                          className="mx-auto w-7 h-7 rounded-md overflow-hidden flex items-center justify-center text-sm shadow-sm"
                          style={{ backgroundColor: (rarityColor[card.rarity] || "#ccc") + "20" }}
                        >
                          {isOwned && card.imageUrl ? (
                            <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{isOwned ? categoryEmoji[card.category] || "❓" : "❓"}</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[9px] font-bold text-warm-gray truncate">
                          {isOwned ? card.name : "？？？"}
                        </p>
                        <p className="text-[8px] text-warm-gray/45 truncate">
                          Ch.{card.chapter}
                          {isOwned ? ` / ★${owned.stage}` : ""}
                        </p>
                      </button>
                    );
                  })}

                  {Array.from({ length: emptyCount }).map((_, index) => (
                    <div
                      key={`empty-card-${index}`}
                      className="rounded-lg border-2 border-dashed border-white/55 bg-white/20 grid place-items-center text-[9px] text-warm-gray/30"
                    >
                      --
                    </div>
                  ))}
                </div>
              );
            })()
          )}

          {tab === "companions" && (
            mergedCompanions.length === 0 ? (
              <div className="flex-1 grid place-items-center text-center">
                <div>
                  <div className="text-3xl mb-2">🔍</div>
                  <p className="text-sm text-warm-gray/40">仲間がまだいません</p>
                </div>
              </div>
            ) : (
              <div
                className="flex-1 min-h-0 grid gap-2"
                style={{ gridTemplateRows: `repeat(${currentPageSize}, minmax(0, 1fr))` }}
              >
                {renderPageSlots(
                  mergedCompanions.slice(pageStart, pageStart + currentPageSize),
                  currentPageSize,
                  (comp) => (
                    <div key={comp.id} className="rounded-xl border border-white/70 bg-white/70 p-2.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-10 h-10 flex items-center justify-center shrink-0"
                        >
                          {(comp.imageUrl || (comp.type === "hero" ? heroes.find((h: any) => h.id === comp.heroRef)?.imageUrl : undefined)) ? (
                            <img src={comp.imageUrl || (comp.type === "hero" ? heroes.find((h: any) => h.id === comp.heroRef)?.imageUrl : undefined)} alt={comp.name} className="w-full h-full object-cover rounded-full shadow-sm border border-white/50" />
                          ) : (
                            <div className="w-full h-full rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: rarityColor[comp.rarity] + "25" }}>
                              {typeEmoji[comp.type] || "👤"}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-sm text-warm-gray truncate">{comp.name}</p>
                            <Badge variant="rarity" size="xs" color={rarityColor[comp.rarity]}>
                              {comp.rarity}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-warm-gray/45 truncate">
                            Lv.{comp.level} EXP:{comp.exp} / 進化★{comp.evolutionStage}
                          </p>
                          <p className="text-[10px] text-warm-gray/40 truncate">
                            HP{comp.baseStats.hp} ATK{comp.baseStats.atk} DEF{comp.baseStats.def} SPD{comp.baseStats.spd ?? 12}
                          </p>
                        </div>
                      </div>
                    </div>
                  ),
                  "仲間なし"
                )}
              </div>
            )
          )}

          {tab === "items" && (
            <div
              className="flex-1 min-h-0 grid gap-2"
              style={{ gridTemplateRows: `repeat(${currentPageSize}, minmax(0, 1fr))` }}
            >
              {renderPageSlots(
                allItems.slice(pageStart, pageStart + currentPageSize),
                currentPageSize,
                (item) => {
                  const count = mergedItems[item.id] || 0;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-2 ${count > 0
                        ? "bg-white/70 border-white/75"
                        : "bg-gray-100/45 border-white/65 opacity-45"
                        }`}
                    >
                      <div className="flex items-center gap-2 h-full">
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-pastel-yellow/20 flex items-center justify-center text-base shrink-0 shadow-sm border border-white/50">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{itemTypeEmoji[item.type] || "📦"}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-warm-gray truncate">{item.name}</p>
                          <p className="text-[10px] text-warm-gray/45 truncate">効果: {item.effect}</p>
                        </div>
                        <p className="text-sm font-bold text-warm-gray shrink-0">×{count}</p>
                      </div>
                    </div>
                  );
                },
                "アイテムなし"
              )}
            </div>
          )}

          {tab === "bosses" && (
            <div
              className="flex-1 min-h-0 grid gap-2"
              style={{ gridTemplateRows: `repeat(${currentPageSize}, minmax(0, 1fr))` }}
            >
              {renderPageSlots(
                allBosses.slice(pageStart, pageStart + currentPageSize),
                currentPageSize,
                (boss) => {
                  const defeated = currentRun.chapterProgress[boss.chapter]?.bossDefeated;
                  const collBoss = collection.bosses[boss.id];
                  const isDefeated = defeated || collBoss?.defeated;
                  return (
                    <div
                      key={boss.id}
                      className={`rounded-xl border p-2.5 ${isDefeated
                        ? "bg-white/70 border-white/75"
                        : "bg-gray-100/45 border-white/65 opacity-45"
                        }`}
                    >
                      <div className="flex items-center gap-2.5 h-full">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/60 flex items-center justify-center shrink-0 shadow-sm border border-white/50">
                          {isDefeated && boss.imageUrl ? (
                            <img src={boss.imageUrl} alt={boss.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-base">{isDefeated ? "👹" : "❓"}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-warm-gray truncate">
                            {isDefeated ? boss.name : "？？？"}
                          </p>
                          <p className="text-[10px] text-warm-gray/45 truncate">
                            Ch.{boss.chapter} / HP {boss.hp}
                          </p>
                          <p className="text-[10px] text-warm-gray/40 truncate">
                            弱点: {isDefeated ? boss.weakness : "未解析"}
                          </p>
                        </div>
                        {isDefeated && <Badge variant="success" size="xs">撃破</Badge>}
                      </div>
                    </div>
                  );
                },
                "ボスなし"
              )}
            </div>
          )}

          {tab === "heroes" && (
            <div
              className="flex-1 min-h-0 grid gap-2"
              style={{ gridTemplateRows: `repeat(${currentPageSize}, minmax(0, 1fr))` }}
            >
              {renderPageSlots(
                heroes.slice(pageStart, pageStart + currentPageSize),
                currentPageSize,
                (hero) => {
                  const heroCol = collection.heroes[hero.id];
                  const isUsed = heroCol?.used || hero.id === currentRun.selectedHeroId;
                  const maxStage = heroCol?.maxStage || (hero.id === currentRun.selectedHeroId ? 1 : 0);
                  return (
                    <div
                      key={hero.id}
                      className={`rounded-xl border p-2.5 ${isUsed
                        ? "bg-white/70 border-white/75"
                        : "bg-gray-100/45 border-white/65 opacity-45"
                        }`}
                    >
                      <div className="flex items-center gap-2.5 h-full">
                        <div
                          className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-sm border border-white/50"
                          style={{ backgroundColor: hero.themeColor + "20" }}
                        >
                          {isUsed && hero.imageUrl ? (
                            <img src={hero.imageUrl} alt={hero.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl">{isUsed ? heroAvatars[hero.id] || "❓" : "❓"}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-warm-gray truncate">
                            {isUsed ? hero.name : "？？？"}
                          </p>
                          <p className="text-[10px] text-warm-gray/45 truncate">
                            {isUsed ? hero.profession : "未発見"}
                          </p>
                          <p className="text-[10px] text-warm-gray/40 truncate">
                            進化進捗: ★{maxStage}/3
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                },
                "主人公なし"
              )}
            </div>
          )}

          <div className="mt-2 shrink-0 flex items-center gap-2">
            <button
              onClick={() =>
                updateCurrentTabPage(Math.max(0, Math.min(tabPage[tab], totalPages - 1) - 1))
              }
              disabled={clampedPage === 0}
              className={`flex-1 min-h-10 rounded-lg text-sm font-bold ${clampedPage === 0
                ? "bg-gray-100 text-warm-gray/30"
                : "bg-indigo-100/70 text-indigo-700 btn-press"
                }`}
            >
              ← 前へ
            </button>
            <p className="text-[11px] text-warm-gray/50 shrink-0 min-w-20 text-center">
              {clampedPage + 1}/{totalPages} ページ
            </p>
            <button
              onClick={() =>
                updateCurrentTabPage(Math.min(totalPages - 1, Math.min(tabPage[tab], totalPages - 1) + 1))
              }
              disabled={clampedPage >= totalPages - 1}
              className={`flex-1 min-h-10 rounded-lg text-sm font-bold ${clampedPage >= totalPages - 1
                ? "bg-gray-100 text-warm-gray/30"
                : "bg-indigo-100/70 text-indigo-700 btn-press"
                }`}
            >
              次へ →
            </button>
          </div>
        </GlassCard>
      </div>

      <Modal
        open={!!selectedCard}
        onClose={() => {
          setSelectedCardId(null);
          setShowSkinPicker(false);
        }}
        position="bottom"
        showHandle
      >
        {selectedCard && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center text-2xl shadow-sm"
                style={{ backgroundColor: (rarityColor[selectedCard.rarity] || "#ccc") + "20" }}
              >
                {selectedOwnedCard && selectedCard.imageUrl ? (
                  <img src={selectedCard.imageUrl} alt={selectedCard.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{selectedOwnedCard ? categoryEmoji[selectedCard.category] || "🃏" : "❓"}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="font-bold text-base text-warm-gray truncate">
                    {selectedOwnedCard ? selectedCard.name : "？？？"}
                  </p>
                  <Badge variant="rarity" size="xs" color={rarityColor[selectedCard.rarity]}>
                    {selectedCard.rarity}
                  </Badge>
                </div>
                <p className="text-[11px] text-warm-gray/45">
                  Ch.{selectedCard.chapter} / {selectedCard.attribute} / ATK {selectedCard.attackPower}
                </p>
              </div>
            </div>

            <GlassCard
              className={`p-3 !bg-white/55 ${selectedOwnedCard ? skinStyles[(selectedOwnedCard.skin || "normal") as CardSkinId]?.bg || "" : ""}`}
            >
              <p className="text-[11px] text-warm-gray/60 leading-relaxed mb-2">
                {selectedOwnedCard ? selectedCard.description : "このカードは未発見です。クイズやボス戦で探索しましょう。"}
              </p>
              {selectedOwnedCard && (
                <>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedCard.evolutionLine.map((evo, index) => (
                      <Badge
                        key={index}
                        variant={
                          index < selectedOwnedCard.stage
                            ? "success"
                            : index === selectedOwnedCard.stage
                              ? "warning"
                              : "default"
                        }
                        size="xs"
                      >
                        {index === selectedOwnedCard.stage ? "▶ " : ""}
                        {evo}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-[11px] text-warm-gray/45">所持: {selectedOwnedCard.count}枚</p>
                </>
              )}
            </GlassCard>

            {selectedOwnedCard && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-warm-gray">🎨 スキン</p>
                  <button
                    onClick={() => setShowSkinPicker((prev) => !prev)}
                    disabled={!canEditSelectedSkin}
                    className={`text-[11px] font-medium ${canEditSelectedSkin ? "text-coral hover:text-coral/70" : "text-warm-gray/40"
                      }`}
                  >
                    {showSkinPicker ? "閉じる" : "変更"}
                    {!canEditSelectedSkin ? "（閲覧）" : ""}
                  </button>
                </div>

                {showSkinPicker && canEditSelectedSkin && (
                  <div className="flex flex-wrap gap-1.5">
                    {(["normal", "pastel", "sparkle", "pixel"] as CardSkinId[]).map((skinId) => {
                      const unlocked = meta.cardSkins.includes(skinId);
                      const style = skinStyles[skinId];
                      return (
                        <button
                          key={skinId}
                          onClick={() => unlocked && handleChangeSkin(selectedCard.id, skinId)}
                          disabled={!unlocked}
                          className={`text-[10px] px-2 py-1 rounded-lg border transition-all btn-press ${selectedOwnedCard.skin === skinId
                            ? `${style.border} bg-coral/10 font-bold text-coral`
                            : unlocked
                              ? `${style.border} hover:bg-white/60 text-warm-gray`
                              : "border-gray-200 text-gray-300"
                            }`}
                        >
                          {unlocked ? style.label : `🔒 ${style.label}`}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <PastelButton
              fullWidth
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => {
                setSelectedCardId(null);
                setShowSkinPicker(false);
              }}
            >
              閉じる
            </PastelButton>
          </div>
        )}
      </Modal>
    </ScreenLayout>
  );
}

function mergeOwnedCards(
  collectionCards: Record<string, OwnedCard>,
  runCards: Record<string, OwnedCard>
): Record<string, OwnedCard> {
  const merged: Record<string, OwnedCard> = { ...collectionCards };
  for (const [cardId, runCard] of Object.entries(runCards)) {
    const existing = merged[cardId];
    if (!existing) {
      merged[cardId] = { ...runCard };
      continue;
    }
    merged[cardId] = {
      stage: Math.max(existing.stage, runCard.stage),
      count: Math.max(existing.count, runCard.count),
      skin: runCard.skin || existing.skin,
    };
  }
  return merged;
}

function mergeCompanions(
  collectionCompanions: Companion[],
  runCompanions: Companion[]
): Companion[] {
  const merged = new Map<string, Companion>();
  for (const comp of collectionCompanions) {
    merged.set(comp.id, { ...comp });
  }
  for (const comp of runCompanions) {
    const existing = merged.get(comp.id);
    if (!existing) {
      merged.set(comp.id, { ...comp });
      continue;
    }
    merged.set(comp.id, {
      ...existing,
      ...comp,
      level: Math.max(existing.level, comp.level),
      exp: Math.max(existing.exp, comp.exp),
      evolutionStage: Math.max(existing.evolutionStage, comp.evolutionStage),
    });
  }
  return Array.from(merged.values());
}

function mergeItems(
  collectionItems: Record<string, number>,
  runItems: Record<string, number>
): Record<string, number> {
  const merged: Record<string, number> = { ...collectionItems };
  for (const [itemId, count] of Object.entries(runItems)) {
    merged[itemId] = Math.max(merged[itemId] || 0, count);
  }
  return merged;
}
