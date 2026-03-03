import { useState, useEffect } from "react";
import { useGameStore } from "../stores/gameStore";
import type { StoryScene, HeroId } from "../types";
import storyData from "../data/story.json";
import heroesData from "../data/heroes.json";
import type { Hero } from "../types";

const stories = storyData as StoryScene[];
const heroes = heroesData as Hero[];

const speakerEmoji: Record<string, string> = {
  "ミコト先輩": "👩‍⚕️",
  "プレイヤー": "🧑",
  "ナレーター": "📖",
  "教授": "👨‍🏫",
  "ミナト": "💗",
  "ヒカリ": "💜",
  "コトハ": "💚",
  "レオン": "💙",
  "ミュータントウイルス": "🦠",
  "カオスオルガン": "👹",
  "フラクチャーゴーレム": "💀",
  "アネミアドラゴン": "🐉",
  "メタボリックスネーク": "🐍",
  "不整脈ファントム": "👻",
  "無呼吸シャドウ": "🌑",
  "ニューロカオス": "🧠",
  "パンデミックキング": "👑",
};


const speakerImages: Record<string, string> = {
  "ミコト先輩": "/orgamon-quest/images/heroes/mikoto.png",
  "ミナト": "/orgamon-quest/images/heroes/minato.png",
  "ヒカリ": "/orgamon-quest/images/heroes/hikari.png",
  "コトハ": "/orgamon-quest/images/heroes/kotoha.png",
  "レオン": "/orgamon-quest/images/heroes/leon.png",
  "ミュータントウイルス": "/orgamon-quest/images/bosses/mutant_virus.png",
  "カオスオルガン": "/orgamon-quest/images/bosses/chaos_organ.png",
  "フラクチャーゴーレム": "/orgamon-quest/images/bosses/fracture_golem.png",
  "アネミアドラゴン": "/orgamon-quest/images/bosses/anemia_dragon.png",
  "メタボリックスネーク": "/orgamon-quest/images/bosses/metabolic_snake.png",
  "不整脈ファントム": "/orgamon-quest/images/bosses/arrhythmia_phantom.png",
  "無呼吸シャドウ": "/orgamon-quest/images/bosses/apnea_shadow.png",
  "ニューロカオス": "/orgamon-quest/images/bosses/neuro_chaos.png",
  "パンデミックキング": "/orgamon-quest/images/bosses/pandemic_king.png",
};

const emotionBg: Record<string, string> = {
  neutral: "bg-white/80",
  cheerful: "bg-pastel-green/20",
  happy: "bg-pastel-yellow/20",
  excited: "bg-pastel-pink/20",
  worried: "bg-orange-50",
  serious: "bg-pastel-blue/20",
  determined: "bg-coral-light",
  confident: "bg-lavender-light",
  curious: "bg-pastel-purple/20",
  hostile: "bg-red-50",
};

function getStoryScene(chapter: number, timing: string, heroId?: HeroId): StoryScene | null {
  if (heroId) {
    const heroScene = stories.find((s) => s.chapter === chapter && s.timing === timing && s.heroVariant === heroId);
    if (heroScene) return heroScene;
  }
  return stories.find((s) => s.chapter === chapter && s.timing === timing && !s.heroVariant) || null;
}

function getEndingScene(heroId: HeroId): StoryScene | null {
  return stories.find((s) => s.timing === "ending" && s.heroVariant === heroId) || null;
}

export default function StoryScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const currentRun = useGameStore((s) => s.currentRun);
  const gameState = useGameStore.getState() as Record<string, unknown>;
  const chapter = (gameState._battleChapter as number) || (gameState._storyChapter as number) || 1;
  const storyTiming = (gameState._storyTiming as string) || "pre_boss";
  const heroId = currentRun?.selectedHeroId;
  const hero = heroes.find((h) => h.id === heroId);

  const [dialogueIdx, setDialogueIdx] = useState(0);
  const [scenes, setScenes] = useState<StoryScene[]>([]);
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const [showChar, setShowChar] = useState(false);

  useEffect(() => {
    const collected: StoryScene[] = [];
    if (storyTiming === "pre_boss") {
      const introScene = getStoryScene(chapter, "intro", heroId);
      if (introScene) collected.push(introScene);
      const heroIntro = heroId ? stories.find((s) => s.chapter === chapter && s.timing === "intro" && s.heroVariant === heroId) : null;
      if (heroIntro && !collected.some((s) => s.id === heroIntro.id)) collected.push(heroIntro);
      const preBoss = getStoryScene(chapter, "pre_boss", heroId);
      if (preBoss) collected.push(preBoss);
    } else if (storyTiming === "post_boss") {
      const postBoss = getStoryScene(chapter, "post_boss", heroId);
      if (postBoss) collected.push(postBoss);
      const ending = getStoryScene(chapter, "ending", heroId);
      if (ending) collected.push(ending);
    } else if (storyTiming === "game_ending") {
      const postBoss = getStoryScene(chapter, "post_boss", heroId);
      if (postBoss) collected.push(postBoss);
      if (heroId) { const heroEnding = getEndingScene(heroId); if (heroEnding) collected.push(heroEnding); }
    } else if (storyTiming === "game_start" || storyTiming === "hero_intro") {
      const s = stories.find((s) => s.chapter === 0 && s.timing === storyTiming && (storyTiming === "game_start" || s.heroVariant === heroId));
      if (s) collected.push(s);
    } else {
      const scene = getStoryScene(chapter, storyTiming, heroId);
      if (scene) collected.push(scene);
    }
    setScenes(collected);
    setCurrentSceneIdx(0);
    setDialogueIdx(0);

    if (collected.length === 0) {
      // Auto-skip if no story exists for this chapter/timing
      setScreen(storyTiming === "pre_boss" ? "battle" : "chapter_map");
      return;
    }

    setTimeout(() => setShowChar(true), 100);
  }, [chapter, storyTiming, heroId, setScreen]);

  if ((!currentRun && storyTiming !== "game_start") || scenes.length === 0) {
    const handleSkip = () => {
      if (storyTiming === "game_start") setScreen("hero_select");
      else if (storyTiming === "hero_intro") setScreen("home");
      else setScreen(storyTiming === "pre_boss" ? "battle" : "chapter_map");
    };
    return (
      <div className="h-[100dvh] flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-float">📖</div>
          <p className="text-warm-gray/50 text-sm mb-4">ストーリーを読み込み中...</p>
          <button onClick={handleSkip} className="px-6 py-2 glass rounded-xl text-warm-gray text-sm btn-press">スキップ →</button>
        </div>
      </div>
    );
  }

  const currentScene = scenes[currentSceneIdx];
  const currentDialogue = currentScene?.dialogue[dialogueIdx];
  const isLastDialogue = dialogueIdx >= (currentScene?.dialogue.length || 1) - 1;
  const isLastScene = currentSceneIdx >= scenes.length - 1;

  const handleTap = () => {
    setShowChar(false);
    setTimeout(() => {
      if (!isLastDialogue) { setDialogueIdx((i) => i + 1); }
      else if (!isLastScene) { setCurrentSceneIdx((i) => i + 1); setDialogueIdx(0); }
      else {
        if (storyTiming === "game_start") setScreen("hero_select");
        else if (storyTiming === "hero_intro") setScreen("home");
        else setScreen(storyTiming === "pre_boss" ? "battle" : storyTiming === "post_boss" || storyTiming === "game_ending" ? "chapter_map" : "home");
      }
      setShowChar(true);
    }, 150);
  };

  const handleSkipAll = () => {
    if (storyTiming === "game_start") setScreen("hero_select");
    else if (storyTiming === "hero_intro") setScreen("home");
    else setScreen(storyTiming === "pre_boss" ? "battle" : storyTiming === "post_boss" || storyTiming === "game_ending" ? "chapter_map" : "home");
  };

  if (!currentDialogue) return null;

  const bgEmotion = emotionBg[currentDialogue.emotion || "neutral"] || "bg-white/80";
  const emoji = speakerEmoji[currentDialogue.speaker] || "💬";
  const isEnemy = currentDialogue.emotion === "hostile";
  const isMikoto = currentDialogue.speaker === "ミコト先輩";

  return (
    <div className="h-[100dvh] flex flex-col px-4 py-5 cursor-pointer relative overflow-hidden" onClick={handleTap}>
      {/* BG */}
      <div className="absolute inset-0 -z-10" style={{
        background: isEnemy ? "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)" : `linear-gradient(135deg, ${hero?.themeColor || "#f08080"}15 0%, ${hero?.themeColor || "#b8a9c9"}08 100%)`,
      }} />

      {/* Skip */}
      <div className="flex justify-end mb-4">
        <button onClick={(e) => { e.stopPropagation(); handleSkipAll(); }}
          className="px-4 py-1.5 glass rounded-xl text-[11px] text-warm-gray/50 hover:bg-white/60 transition-all btn-press">
          スキップ ▶▶
        </button>
      </div>

      {/* Chapter */}
      <div className="text-center mb-4">
        <p className="text-[11px] text-warm-gray/30 tracking-wider">
          {chapter > 0 ? `Ch.${chapter}` : ""}{" "}
          {storyTiming === "pre_boss" ? "ボス戦前" : storyTiming === "post_boss" ? "ボス撃破後" : storyTiming === "game_ending" ? "エンディング" : storyTiming === "intro" ? "章の始まり" : ""}
        </p>
      </div>

      {/* Speaker */}
      <div className={`flex-1 flex flex-col items-center justify-center transition-all duration-300 ${showChar ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        <div className={`w-36 h-36 rounded-full flex items-center justify-center text-5xl mb-4 shadow-lg overflow-hidden ${isEnemy ? "bg-red-100 animate-pulse border-4 border-red-300" : isMikoto ? "bg-white border-4 border-pastel-pink/50" : "glass-strong border-4 border-white/60"
          }`}>
          {speakerImages[currentDialogue.speaker] ? (
            <img src={speakerImages[currentDialogue.speaker]} alt={currentDialogue.speaker} className="w-full h-full object-cover object-top" />
          ) : currentDialogue.speaker === "プレイヤー" && hero ? (
            <img src={hero.imageUrl} alt={hero.name} className="w-full h-full object-cover object-top" />
          ) : (
            emoji
          )}
        </div>
        <p className={`text-xl font-extrabold mb-1 tracking-wider ${isEnemy ? "text-red-500" : "text-gray-700"}`}>
          {currentDialogue.speaker === "プレイヤー" ? (hero?.name || "プレイヤー") : currentDialogue.speaker}
        </p>
      </div>

      {/* Dialogue */}
      <div className={`${bgEmotion} backdrop-blur rounded-2xl p-5 shadow-md mb-4 border ${isEnemy ? "border-red-200/50" : "border-white/30"} animate-slide-up`}>
        <p className="text-base text-warm-gray leading-relaxed">{currentDialogue.text}</p>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          {scenes.map((_, si) => (
            <div key={si} className="flex gap-0.5">
              {scenes[si].dialogue.map((_, di) => (
                <div key={di} className={`w-1.5 h-1.5 rounded-full transition-all ${si < currentSceneIdx || (si === currentSceneIdx && di <= dialogueIdx) ? "bg-coral" : "bg-gray-200/60"
                  }`} />
              ))}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-warm-gray/30 animate-pulse">タップで次へ</p>
      </div>
    </div>
  );
}
