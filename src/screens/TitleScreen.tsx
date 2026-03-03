import { useEffect } from "react";
import { useGameStore } from "../stores/gameStore";
import { audio } from "../utils/audio";
import { PastelButton } from "../components/common";
import titleLogo from "../assets/title_logo.png";

export default function TitleScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  useEffect(() => { audio.playBGM("title"); }, []);
  const currentRun = useGameStore((s) => s.currentRun);

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center px-6 py-10 text-center relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-8 left-6 w-36 h-36 bg-pastel-pink/25 rounded-full blur-3xl animate-float" />
      <div
        className="absolute bottom-16 right-4 w-44 h-44 bg-pastel-purple/25 rounded-full blur-3xl animate-float"
        style={{ animationDelay: "1s" }}
      />
      <div
        className="absolute top-1/3 right-8 w-28 h-28 bg-pastel-green/20 rounded-full blur-2xl animate-float"
        style={{ animationDelay: "2s" }}
      />
      <div
        className="absolute bottom-1/3 left-4 w-24 h-24 bg-pastel-blue/20 rounded-full blur-2xl animate-float"
        style={{ animationDelay: "0.5s" }}
      />

      {/* Floating particles */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full opacity-40 animate-float"
          style={{
            width: `${4 + Math.random() * 8}px`,
            height: `${4 + Math.random() * 8}px`,
            background: ["#f08080", "#b8a9c9", "#98d4bb", "#87ceeb", "#ffb6c1", "#d8b4fe"][i % 6],
            left: `${5 + (i * 8)}%`,
            top: `${10 + ((i * 17) % 70)}%`,
            animationDelay: `${i * 0.3}s`,
            animationDuration: `${3 + (i % 3)}s`,
          }}
        />
      ))}

      {/* Logo area */}
      <div className="relative z-10 mb-4 animate-slide-up">
        <div className="w-40 h-40 mx-auto mb-3 animate-float drop-shadow-lg">
          <img
            src={titleLogo}
            alt="オルガモン図鑑クエスト"
            className="w-full h-full object-contain"
          />
        </div>
        <h1 className="text-4xl font-extrabold text-warm-gray tracking-wider mb-1">
          オルガモン
        </h1>
        <h2 className="text-3xl font-extrabold text-gradient-coral tracking-wide">
          図鑑クエスト
        </h2>
        <p className="text-sm text-warm-gray/50 mt-3 tracking-wide">
          人体の世界を冒険しよう！
        </p>
      </div>

      {/* Sparkle row */}
      <div className="flex gap-3 mb-8 relative z-10">
        {["💫", "✨", "🌟", "✨", "💫"].map((emoji, i) => (
          <span
            key={i}
            className="text-xl animate-float"
            style={{ animationDelay: `${i * 0.2}s` }}
          >
            {emoji}
          </span>
        ))}
      </div>

      {/* Buttons */}
      <div
        className="relative z-10 w-full max-w-xs space-y-3 animate-slide-up"
        style={{ animationDelay: "0.15s" }}
      >
        <PastelButton
          fullWidth
          size="lg"
          gradient="coral"
          icon="🎮"
          onClick={() => {
            useGameStore.setState({ _storyTiming: "game_start", _storyChapter: 0 } as any);
            setScreen("story");
          }}
        >
          はじめから
        </PastelButton>

        {currentRun && (
          <PastelButton
            fullWidth
            size="lg"
            gradient="lavender"
            icon="📖"
            onClick={() => { audio.playSE("click"); setScreen("home"); }}
          >
            つづきから
          </PastelButton>
        )}

        <PastelButton
          fullWidth
          size="md"
          variant="secondary"
          icon="⚙️"
          onClick={() => setScreen("settings")}
        >
          せってい
        </PastelButton>
      </div>

      {/* Footer */}
      <p className="absolute bottom-5 text-[10px] text-warm-gray/30 tracking-wider">
        © 2026 オルガモン図鑑クエスト
      </p>
    </div>
  );
}
