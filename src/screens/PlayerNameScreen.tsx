import { useState } from "react";
import { useGameStore } from "../stores/gameStore";
import { ScreenLayout, GlassCard, PastelButton } from "../components/common";
import type { HeroId } from "../types";

export default function PlayerNameScreen() {
  const [name, setName] = useState("");
  const startNewGame = useGameStore((s) => s.startNewGame);
  const setScreen = useGameStore((s) => s.setScreen);
  const pendingHeroId = useGameStore((s) => s.pendingHeroId);

  const handleStart = () => {
    if (!name.trim()) return;
    const heroId: HeroId = pendingHeroId || "minato";
    startNewGame(heroId, name.trim());
    useGameStore.setState({ _storyTiming: "hero_intro", _storyChapter: 0, screen: "story" } as any);
  };

  return (
    <ScreenLayout>
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4 animate-float">📝</div>
            <h1 className="text-xl font-bold text-warm-gray">
              なまえを入力してね
            </h1>
            <p className="text-sm text-warm-gray/50 mt-1">
              オルガモンワールドでの名前だよ
            </p>
          </div>

          <GlassCard variant="strong" className="p-6 mb-6">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={10}
              placeholder="プレイヤー名（10文字まで）"
              className="w-full px-4 py-3.5 bg-white rounded-xl border-2 border-pastel-pink/30 focus:border-coral focus:outline-none text-center text-lg font-bold text-warm-gray placeholder:text-warm-gray/25 transition-all duration-200 focus:shadow-md"
              autoFocus
            />
            <p className="text-[10px] text-warm-gray/30 text-center mt-2 tracking-wider">
              {name.length}/10
            </p>
          </GlassCard>

          <div className="flex gap-3">
            <PastelButton
              variant="secondary"
              className="flex-1"
              onClick={() => setScreen("hero_select")}
            >
              ← もどる
            </PastelButton>
            <PastelButton
              gradient="coral"
              className="flex-1"
              icon="🚀"
              disabled={!name.trim()}
              onClick={handleStart}
            >
              冒険スタート！
            </PastelButton>
          </div>
        </div>
      </div>
    </ScreenLayout>
  );
}
