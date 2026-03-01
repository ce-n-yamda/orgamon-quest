import { useState } from "react";
import { useGameStore } from "../stores/gameStore";
import { useDailyStore } from "../stores/dailyStore";
import { ScreenLayout, GlassCard, Badge } from "../components/common";
import { getHeroById } from "../logic/skillLogic";
import type { ShopItem, Item } from "../types";
import shopData from "../data/shop.json";
import itemsData from "../data/items.json";

const shopItems = shopData as ShopItem[];
const items = itemsData as Item[];
const MAX_SHOP_PAGES = 3;

const rarityBg: Record<string, string> = {
  Common: "!bg-mint/10",
  Rare: "!bg-lavender/10",
  Epic: "!bg-coral/10",
};

const typeEmoji: Record<string, string> = {
  consumable: "🧪",
  enhance: "⬆️",
  cure: "💊",
  collection: "🎨",
};

const rarityColor: Record<string, string> = {
  Common: "#98d4bb",
  Rare: "#b8a9c9",
  Epic: "#f08080",
};

export default function ShopScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const currentRun = useGameStore((s) => s.currentRun);
  const spendMP = useGameStore((s) => s.spendMP);
  const addItem = useGameStore((s) => s.addItem);
  const progressMission = useDailyStore((s) => s.progressMission);
  const [purchasedMsg, setPurchasedMsg] = useState<string | null>(null);
  const [purchasedCounts, setPurchasedCounts] = useState<Record<string, number>>({});
  const [shopPage, setShopPage] = useState(0);

  const heroForDiscount = currentRun ? getHeroById(currentRun.selectedHeroId) : null;
  const hasHealSkill = heroForDiscount && [heroForDiscount.ultimate, ...(heroForDiscount.skills || [])]
    .some(skill => skill.effects.some(e => e.type === "heal_homeostasis" || e.type === "hot_heal"));

  if (!currentRun) return null;

  const shopItemsPerPage = Math.max(3, Math.ceil(Math.max(shopItems.length, 1) / MAX_SHOP_PAGES));
  const totalPages = Math.max(1, Math.ceil(shopItems.length / shopItemsPerPage));
  const clampedPage = Math.min(shopPage, totalPages - 1);
  const pageStart = clampedPage * shopItemsPerPage;
  const visibleShopItems = shopItems.slice(pageStart, pageStart + shopItemsPerPage);

  const showMessage = (msg: string) => {
    setPurchasedMsg(msg);
    setTimeout(() => setPurchasedMsg(null), 1500);
  };

  const handlePurchase = (shopItem: ShopItem, item: Item, finalCost: number) => {
    const bought = purchasedCounts[shopItem.id] || 0;
    if (bought >= shopItem.stock) {
      showMessage("在庫切れです！");
      return;
    }
    const owned = currentRun.ownedItems[shopItem.itemId] || 0;
    if (owned >= 10) {
      showMessage("所持上限（10個）に達しています！");
      return;
    }
    if (!spendMP(finalCost)) {
      showMessage("MPが足りません！");
      return;
    }
    addItem(shopItem.itemId);
    progressMission("item_use_1");
    setPurchasedCounts((prev) => ({ ...prev, [shopItem.id]: (prev[shopItem.id] || 0) + 1 }));
    showMessage(`${item.name} を購入しました！ ✨`);
  };

  return (
    <ScreenLayout bgImage="/orgamon-quest/images/backgrounds/shop_bg.webp"
      onBack={() => setScreen("home")}
      title="ショップ"
      titleEmoji="🛍️"
      padding="compact"
      className="min-h-[100dvh] flex flex-col pb-[calc(env(safe-area-inset-bottom)+0.25rem)]"
    >
      <div className="flex-1 flex flex-col gap-2.5">
        <GlassCard variant="strong" className="p-3 shrink-0 flex items-center justify-between">
          <span className="text-sm text-warm-gray/75">所持ポイント</span>
          <span className="text-lg font-bold text-warm-gray">💰 {currentRun.mp} MP</span>
        </GlassCard>

        {purchasedMsg && (
          <div className="bg-pastel-green/55 text-green-800 rounded-xl px-3 py-2 text-center text-sm font-medium animate-pop shrink-0">
            {purchasedMsg}
          </div>
        )}

        <div className="flex flex-col gap-2.5 pb-2">
          {visibleShopItems.map((shopItem) => {
            const item = items.find((entry) => entry.id === shopItem.itemId);
            if (!item) return null;

            const bought = purchasedCounts[shopItem.id] || 0;
            const remaining = shopItem.stock - bought;
            const owned = currentRun.ownedItems[shopItem.itemId] || 0;
            const isHealItem = item.id === "homeostasis_elixir";
            const isDiscounted = !hasHealSkill && isHealItem;
            const finalCost = isDiscounted ? Math.floor(shopItem.pointCost * 0.5) : shopItem.pointCost;
            const canAfford = currentRun.mp >= finalCost;
            const soldOut = remaining <= 0;
            const maxOwned = owned >= 10;

            return (
              <GlassCard
                key={shopItem.id}
                variant="strong"
                className={`p-2.5 ${rarityBg[item.rarity] || ""} ${soldOut || maxOwned ? "opacity-70" : ""}`}
                accentColor={rarityColor[item.rarity]}
              >
                <div className="flex items-start gap-2.5 h-full">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-sm overflow-hidden"
                    style={{ backgroundColor: (rarityColor[item.rarity] || "#ccc") + "20" }}
                  >
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain scale-110" />
                    ) : (
                      typeEmoji[item.type] || "📦"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <p className="font-bold text-warm-gray text-sm truncate">{item.name}</p>
                      {shopItem.weeklyOnly && (
                        <Badge variant="danger" size="xs" icon="🔥">週替わり</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-warm-gray/70 truncate">{item.effect}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Badge variant="default" size="xs">残{remaining}</Badge>
                      <Badge variant="default" size="xs">所持{owned}/10</Badge>
                    </div>
                    <div className="mt-2">
                      <button
                        onClick={() => handlePurchase(shopItem, item, finalCost)}
                        disabled={!canAfford || soldOut || maxOwned}
                        className={`w-full min-h-8 rounded-lg text-sm font-bold transition-all btn-press flex items-center justify-center ${canAfford && !soldOut && !maxOwned
                          ? "bg-gradient-to-r from-coral to-pastel-pink text-white shadow-sm"
                          : "bg-gray-200 text-gray-400"
                          }`}
                      >
                        {soldOut ? "売切" : maxOwned ? "上限" : isDiscounted ? (
                          <span className="flex items-center justify-center gap-1.5 w-full relative">
                            <span className="line-through text-[11px] opacity-70">💰{shopItem.pointCost}</span>
                            <span className="text-yellow-100 font-extrabold text-[15px]">💰{finalCost}</span>
                          </span>
                        ) : `💰 ${finalCost}`}
                      </button>
                    </div>
                  </div>
                </div>
              </GlassCard>
            );
          })}

          {visibleShopItems.length < shopItemsPerPage &&
            Array.from({ length: shopItemsPerPage - visibleShopItems.length }).map((_, index) => (
              <div
                key={`empty-${index}`}
                className="rounded-2xl border-2 border-dashed border-white/55 bg-white/20 grid place-items-center text-[11px] text-warm-gray/55"
              >
                商品なし
              </div>
            ))}
        </div>

        <GlassCard className="p-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShopPage((prev) => Math.max(0, Math.min(prev, totalPages - 1) - 1))}
              disabled={clampedPage === 0}
              className={`flex-1 min-h-10 rounded-lg text-sm font-bold ${clampedPage === 0
                ? "bg-gray-100 text-warm-gray/55"
                : "bg-indigo-100/70 text-indigo-700 btn-press"
                }`}
            >
              ← 前へ
            </button>
            <p className="text-[11px] text-warm-gray/70 shrink-0 min-w-20 text-center">
              {clampedPage + 1}/{totalPages} ページ
            </p>
            <button
              onClick={() =>
                setShopPage((prev) =>
                  Math.min(totalPages - 1, Math.min(prev, totalPages - 1) + 1)
                )
              }
              disabled={clampedPage >= totalPages - 1}
              className={`flex-1 min-h-10 rounded-lg text-sm font-bold ${clampedPage >= totalPages - 1
                ? "bg-gray-100 text-warm-gray/55"
                : "bg-indigo-100/70 text-indigo-700 btn-press"
                }`}
            >
              次へ →
            </button>
          </div>
        </GlassCard>
      </div>
    </ScreenLayout>
  );
}
