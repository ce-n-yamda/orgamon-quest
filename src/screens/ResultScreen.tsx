import { useState, useEffect } from "react";
import { useGameStore } from "../stores/gameStore";
import { useDailyStore } from "../stores/dailyStore";
import { useMetaStore } from "../stores/metaStore";
import { tryCapture } from "../logic/captureLogic";
import { rollCompanionAppear, addCompanionExp } from "../logic/companionLogic";
import { rollMultipleItemDrops } from "../logic/itemLogic";
import { checkAchievements, getAchievementReward, getTitleForChapterClear } from "../logic/achievementLogic";
import { getChapterDropMultiplier } from "../logic/dailyLogic";
import { GlassCard, PastelButton, ProgressBar, Badge, ParticleEffect } from "../components/common";
import { audio } from "../utils/audio";
import heroesData from "../data/heroes.json";
import type { QuizResult, Card, Companion, Hero } from "../types";

const rarityColor: Record<string, string> = { Common: "#98d4bb", Rare: "#b8a9c9", Epic: "#f08080", Legend: "#ffd700" };

const heroes = heroesData as Hero[];

export default function ResultScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const currentRun = useGameStore((s) => s.currentRun);
  const addCard = useGameStore((s) => s.addCard);
  const addCompanion = useGameStore((s) => s.addCompanion);
  const addItem = useGameStore((s) => s.addItem);
  const spendCaptureEnergy = useGameStore((s) => s.spendCaptureEnergy);
  const updateCompanion = useGameStore((s) => s.updateCompanion);
  const progressMission = useDailyStore((s) => s.progressMission);
  const unlockAchievement = useMetaStore((s) => s.unlockAchievement);
  const addTitle = useMetaStore((s) => s.addTitle);
  const addMP = useGameStore((s) => s.addMP);
  const meta = useMetaStore((s) => s.meta);

  const gameState = useGameStore.getState() as Record<string, unknown>;
  const result = (gameState._quizResult as QuizResult) || null;
  const rewards = (gameState._quizRewards as { xp: number; mp: number; captureEnergy: number; fragments: number; isPerfect: boolean }) || null;

  const [capturedCards, setCapturedCards] = useState<Card[]>([]);
  const [newCompanion, setNewCompanion] = useState<Companion | null>(null);
  const [droppedItems, setDroppedItems] = useState<{ itemId: string; item: { name: string; imageUrl?: string } }[]>([]);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const [phase, setPhase] = useState<"score" | "capture" | "companion" | "items" | "achievements" | "done">("score");
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    audio.playBGM("result");
    // Do not stop BGM on unmount so it flows back to map smoothly, or we stop it.
  }, []);

  useEffect(() => {
    if (!result || !rewards || !currentRun || processed) return;
    setProcessed(true);
    const correctRate = result.correct / result.total;
    const dropMultiplier = getChapterDropMultiplier(result.chapter);
    progressMission("quiz_play_1"); progressMission("quiz_play_3");
    if (result.maxStreak >= 3) progressMission("streak_3");
    if (result.maxStreak >= 5) progressMission("streak_5");
    if (result.correct === result.total) progressMission("perfect_quiz");
    if (currentRun.captureEnergy >= 3) {
      const adjustedEnergy = Math.floor(currentRun.captureEnergy * dropMultiplier);
      const captureResult = tryCapture(adjustedEnergy, result.chapter, currentRun.level);
      setCapturedCards(captureResult.capturedCards);
      spendCaptureEnergy(captureResult.energySpent);
      captureResult.capturedCards.forEach((card) => addCard(card.id));
      if (captureResult.capturedCards.length > 0) { progressMission("card_capture_1"); progressMission("card_capture_3", captureResult.capturedCards.length); }
    }
    const ownedIds = currentRun.ownedCompanions.map((c) => c.id);
    const companion = rollCompanionAppear(result.chapter, currentRun.selectedHeroId, ownedIds);
    if (companion) { setNewCompanion(companion); addCompanion(companion); progressMission("companion_gain"); }
    const drops = rollMultipleItemDrops(correctRate);
    setDroppedItems(drops);
    drops.forEach((drop) => addItem(drop.itemId));
    currentRun.team.forEach((c) => { const updated = addCompanionExp(c, result.correct * 5); updateCompanion(updated); });
    const updatedRun = useGameStore.getState().currentRun;
    const unlockedAchs = checkAchievements(updatedRun || currentRun, meta.achievements, { chapterClearTime: result.timeTaken });
    if (unlockedAchs.length > 0) {
      setNewAchievements(unlockedAchs);
      unlockedAchs.forEach((achId) => {
        unlockAchievement(achId);
        const reward = getAchievementReward(achId);
        if (reward) { if (reward.type === "mp") addMP(Number(reward.value)); if (reward.type === "title") addTitle(reward.value); }
      });
    }
    const chTitle = getTitleForChapterClear(result.chapter);
    if (chTitle && correctRate >= 0.7) addTitle(chTitle);
  }, [result, rewards, currentRun]);

  if (!result || !rewards || !currentRun) {
    return <div className="h-[100dvh] flex items-center justify-center"><button onClick={() => setScreen("home")} className="text-warm-gray">ホームに戻る</button></div>;
  }

  const rate = Math.round((result.correct / result.total) * 100);
  const isPerfect = result.correct === result.total;
  const getRating = () => {
    if (isPerfect) return { label: "PERFECT!", emoji: "🌟", color: "text-gradient-gold" };
    if (rate >= 80) return { label: "すばらしい！", emoji: "✨", color: "text-green-500" };
    if (rate >= 60) return { label: "よくできました！", emoji: "👏", color: "text-blue-500" };
    if (rate >= 40) return { label: "もう少し！", emoji: "💪", color: "text-orange-500" };
    return { label: "がんばろう！", emoji: "📚", color: "text-warm-gray" };
  };
  const rating = getRating();

  const handleNextPhase = () => {
    const phaseOrder: typeof phase[] = ["score", "capture", "companion", "items", "achievements", "done"];
    const shouldShow: Record<string, boolean> = { capture: capturedCards.length > 0, companion: !!newCompanion, items: droppedItems.length > 0, achievements: newAchievements.length > 0 };
    const currentPhaseIdx = phaseOrder.indexOf(phase);
    for (let i = currentPhaseIdx + 1; i < phaseOrder.length; i++) {
      const next = phaseOrder[i];
      if (next === "done" || shouldShow[next]) { setPhase(next); return; }
    }
    setPhase("done");
  };

  return (
    <div className="h-[100dvh] px-4 py-6 flex flex-col relative overflow-y-auto overflow-x-hidden pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center opacity-40 mix-blend-multiply"
        style={{ backgroundImage: `url('/images/backgrounds/result_bg.webp'), linear-gradient(to bottom right, #fdfbfb, #ebedee)` }}
      />
      <ParticleEffect type={isPerfect ? "confetti" : "sparkle"} active={phase === "score" && isPerfect} count={20} />

      {/* Score phase */}
      {phase === "score" && (
        <>
          <div className="text-center mb-3 relative z-10 animate-pop">
            <div className="text-6xl mb-2">{rating.emoji}</div>
            <h1 className={`text-xl font-extrabold ${rating.color}`}>{rating.label}</h1>
            <p className="text-sm text-warm-gray/50 mt-1">Ch.{result.chapter} {result.chapter === 9 ? "修了テスト" : "クイズ"} 完了！</p>
          </div>
          <GlassCard variant="strong" className="p-4 mb-3 relative z-10 animate-slide-up">
            <div className="text-center mb-4">
              <p className="text-3xl font-extrabold text-warm-gray">{result.correct}/{result.total}</p>
              <p className="text-sm text-warm-gray/40">正解数</p>
            </div>
            <ProgressBar value={rate} max={100} color={rate >= 80 ? "#98d4bb" : rate >= 60 ? "#f0c040" : "#f08080"} size="md" className="mb-4" />
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/50 rounded-xl p-2 text-center"><p className="text-[10px] text-warm-gray/40">正答率</p><p className="text-xl font-bold text-warm-gray">{rate}%</p></div>
              <div className="bg-white/50 rounded-xl p-2 text-center"><p className="text-[10px] text-warm-gray/40">最大連続</p><p className="text-xl font-bold text-warm-gray">🔥 {result.maxStreak}</p></div>
            </div>
          </GlassCard>
          <GlassCard className="p-4 mb-3 relative z-10 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <h3 className="text-sm font-bold text-warm-gray mb-3">🎁 獲得報酬</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-pastel-yellow/20 rounded-xl p-2 text-center"><p className="text-[10px] text-warm-gray/40">経験値</p><p className="text-lg font-bold text-amber-600">+{rewards.xp} XP</p></div>
              <div className="bg-pastel-blue/20 rounded-xl p-2 text-center"><p className="text-[10px] text-warm-gray/40">ポイント</p><p className="text-lg font-bold text-blue-600">+{rewards.mp} MP</p></div>
              <div className="bg-pastel-green/20 rounded-xl p-2 text-center"><p className="text-[10px] text-warm-gray/40">捕獲エネルギー</p><p className="text-lg font-bold text-green-600">+{rewards.captureEnergy}</p></div>
              {rewards.fragments > 0 && <div className="bg-pastel-purple/20 rounded-xl p-2 text-center"><p className="text-[10px] text-warm-gray/40">知識の欠片</p><p className="text-lg font-bold text-purple-600">+{rewards.fragments}</p></div>}
            </div>
            {isPerfect && <div className="mt-3 bg-gradient-to-r from-amber-100/60 to-yellow-100/60 rounded-xl p-2 text-center"><p className="text-sm font-bold text-amber-700">🌟 パーフェクトボーナス！</p></div>}
          </GlassCard>
        </>
      )}

      {/* Capture phase */}
      {phase === "capture" && (
        <div className="flex-1 flex flex-col items-center justify-center relative z-10">
          <div className="text-6xl mb-4 animate-float">🎰</div>
          <h2 className="text-xl font-bold text-warm-gray mb-6">カード捕獲！</h2>
          <div className="w-full space-y-3">
            {capturedCards.map((card, i) => (
              <GlassCard key={i} variant="strong" className={`p-4 flex items-center gap-3 animate-pop ${card.rarity === "Epic" ? "card-epic-glow" : card.rarity === "Legend" ? "card-legend-glow" : ""}`}
                style={{ animationDelay: `${i * 0.2}s` }}>
                <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center text-2xl shrink-0 card-shine shadow-sm" style={{ backgroundColor: rarityColor[card.rarity] + "25" }}>
                  {card.imageUrl ? <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" /> : "🃏"}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2"><p className="font-bold text-warm-gray">{card.name}</p><Badge variant="rarity" size="xs" color={rarityColor[card.rarity]}>{card.rarity}</Badge></div>
                  <p className="text-[11px] text-warm-gray/40">{card.description}</p>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* Companion phase */}
      {phase === "companion" && newCompanion && (
        <div className="flex-1 flex flex-col items-center justify-center relative z-10">
          <div className="text-6xl mb-4 animate-float">🤝</div>
          <h2 className="text-xl font-bold text-warm-gray mb-2">新しい仲間！</h2>
          <p className="text-sm text-warm-gray/50 mb-6">{newCompanion.name}が仲間に加わりました！</p>
          <GlassCard variant="strong" className="w-full p-5 flex flex-col items-center animate-pop">
            <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center text-4xl shadow-sm mb-3 border-4 border-white/80" style={{ backgroundColor: rarityColor[newCompanion.rarity] + "25" }}>
              {(newCompanion.imageUrl || (newCompanion.type === "hero" ? heroes.find(h => h.id === newCompanion.heroRef)?.imageUrl : undefined)) ? <img src={(newCompanion.imageUrl || (newCompanion.type === "hero" ? heroes.find(h => h.id === newCompanion.heroRef)?.imageUrl : undefined))} alt={newCompanion.name} className="w-full h-full object-cover" /> : (newCompanion.type === "hero" ? "⭐" : newCompanion.type === "nurse" ? "💉" : newCompanion.type === "researcher" ? "🔬" : "🛡️")}
            </div>
            <div className="text-center mb-4">
              <div className="flex justify-center items-center gap-2 mb-1"><p className="text-xl font-bold text-warm-gray">{newCompanion.name}</p><Badge variant="rarity" size="sm" color={rarityColor[newCompanion.rarity]}>{newCompanion.rarity}</Badge></div>
              <p className="text-sm text-warm-gray/50">Lv.{newCompanion.level}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="danger" size="sm">HP {newCompanion.baseStats.hp}</Badge>
              <Badge variant="warning" size="sm">ATK {newCompanion.baseStats.atk}</Badge>
              <Badge variant="info" size="sm">DEF {newCompanion.baseStats.def}</Badge>
              <Badge variant="success" size="sm">SPD {newCompanion.baseStats.spd ?? 12}</Badge>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Items phase */}
      {phase === "items" && (
        <div className="flex-1 flex flex-col items-center justify-center relative z-10">
          <div className="text-6xl mb-4 animate-float">🎁</div>
          <h2 className="text-xl font-bold text-warm-gray mb-6">アイテムドロップ！</h2>
          <div className="w-full space-y-3">
            {droppedItems.map((drop, i) => (
              <GlassCard key={i} variant="strong" className="p-4 flex items-center gap-3 animate-pop" style={{ animationDelay: `${i * 0.2}s` }}>
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-pastel-yellow/20 flex items-center justify-center text-2xl shrink-0 shadow-sm border border-white/50">
                  {drop.item.imageUrl ? <img src={drop.item.imageUrl} alt={drop.item.name} className="w-full h-full object-cover" /> : "🎁"}
                </div>
                <div><p className="font-bold text-warm-gray">{drop.item.name}</p><p className="text-[11px] text-warm-gray/40">インベントリに追加されました</p></div>
              </GlassCard>
            ))}
          </div>
        </div>
      )
      }

      {/* Achievements phase */}
      {
        phase === "achievements" && newAchievements.length > 0 && (
          <div className="flex-1 flex flex-col items-center justify-center relative z-10">
            <div className="text-6xl mb-4 animate-float">🏆</div>
            <h2 className="text-xl font-bold text-warm-gray mb-6">実績解除！</h2>
            <div className="w-full space-y-3">
              {newAchievements.map((achId, i) => {
                const reward = getAchievementReward(achId);
                return (
                  <GlassCard key={achId} className="p-4 flex items-center gap-3 animate-pop !bg-pastel-yellow/20" style={{ animationDelay: `${i * 0.2}s` }}>
                    <div className="w-12 h-12 rounded-xl bg-amber-100/60 flex items-center justify-center text-2xl shrink-0">🏆</div>
                    <div className="flex-1"><p className="font-bold text-warm-gray">{achId}</p>
                      {reward && <p className="text-[11px] text-warm-gray/40">報酬: {reward.type === "mp" ? `${reward.value}MP` : reward.type === "title" ? `称号「${reward.value}」` : reward.value}</p>}
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          </div>
        )
      }

      {/* Done */}
      {
        phase === "done" && (
          <div className="flex-1 flex flex-col items-center justify-center relative z-10 animate-pop">
            <GlassCard className="p-4 mb-5 text-center w-full">
              <p className="text-[10px] text-warm-gray/40">現在のレベル</p>
              <p className="text-lg font-bold text-warm-gray">Lv.{currentRun.level} （総XP: {currentRun.totalXP}）</p>
            </GlassCard>
            <div className="space-y-1">
              {capturedCards.length > 0 && <p className="text-[11px] text-warm-gray/40">🃏 カード{capturedCards.length}枚を入手</p>}
              {newCompanion && <p className="text-[11px] text-warm-gray/40">🤝 {newCompanion.name}が仲間に</p>}
              {droppedItems.length > 0 && <p className="text-[11px] text-warm-gray/40">🎁 アイテム{droppedItems.length}個を入手</p>}
            </div>
          </div>
        )
      }

      {/* Actions */}
      <div className="space-y-3 relative z-10 mt-auto shrink-0 pt-4 pb-2">
        {phase !== "done" ? (
          <PastelButton fullWidth size="lg" gradient="coral" icon="✨" onClick={handleNextPhase}>
            {phase === "score" ? (capturedCards.length > 0 || newCompanion || droppedItems.length > 0 ? "報酬を見る →" : "結果を確認 →") : "次へ →"}
          </PastelButton>
        ) : (
          <>
            <PastelButton fullWidth size="lg" gradient="coral" icon="🗺️" onClick={() => setScreen("chapter_map")}>章マップへ</PastelButton>
            <PastelButton fullWidth variant="secondary" icon="🏠" onClick={() => setScreen("home")}>ホームへ</PastelButton>
          </>
        )}
      </div>
    </div >
  );
}
