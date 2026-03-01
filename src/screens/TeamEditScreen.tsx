import { useMemo, useState } from "react";
import { useGameStore } from "../stores/gameStore";
import { ScreenLayout, GlassCard, PastelButton, Badge } from "../components/common";
import heroesData from "../data/heroes.json";
import type { Hero, Companion } from "../types";
import { getCompanionTypeName } from "../logic/companionLogic";
import {
  normalizeBattleFormationIds,
  POSITION_EFFECT_LABELS,
  POSITION_LABELS,
} from "../logic/formationLogic";

const heroes = heroesData as Hero[];
const CANDIDATES_PER_PAGE = 2;
const EMPTY_COMPANIONS: Companion[] = [];

const typeEmoji: Record<string, string> = {
  nurse: "💉",
  researcher: "🔬",
  guardian: "🛡️",
  hero: "⭐",
};

const rarityColor: Record<string, string> = {
  Common: "#98d4bb",
  Rare: "#b8a9c9",
  Epic: "#f08080",
  Legend: "#ffd700",
};

const heroAvatars: Record<string, string> = {
  minato: "👩‍⚕️",
  hikari: "🔬",
  kotoha: "🪥",
  leon: "🛠️",
};

export default function TeamEditScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const currentRun = useGameStore((s) => s.currentRun);
  const setTeam = useGameStore((s) => s.setTeam);
  const setBattleFormation = useGameStore((s) => s.setBattleFormation);
  const [candidatePage, setCandidatePage] = useState(0);

  const hero = useMemo(
    () =>
      currentRun
        ? heroes.find((h) => h.id === currentRun.selectedHeroId) || null
        : null,
    [currentRun]
  );
  const team = currentRun?.team ?? EMPTY_COMPANIONS;
  const ownedCompanions = currentRun?.ownedCompanions ?? EMPTY_COMPANIONS;

  const formationIds = useMemo(
    () =>
      currentRun && hero
        ? normalizeBattleFormationIds(
          hero.id,
          team,
          currentRun.battleFormationIds
        )
        : [],
    [currentRun, hero, team]
  );

  const formationMembers = useMemo(
    () =>
      formationIds.map((id) => {
        if (!hero || !currentRun) return null;
        if (id === hero.id) {
          return {
            id,
            name: hero.name,
            role: "hero" as const,
            emoji: heroAvatars[hero.id] || "⭐",
            imageUrl: hero.imageUrl,
            subLabel: hero.profession,
            rarity: "Epic",
          };
        }

        const companion = team.find((member) => member.id === id);
        return {
          id,
          name: companion?.name || "不明メンバー",
          role: "companion" as const,
          emoji: companion ? typeEmoji[companion.type] || "👤" : "👤",
          imageUrl: companion?.imageUrl || (companion?.type === "hero" ? heroes.find(h => h.id === companion.heroRef)?.imageUrl : undefined),
          subLabel: companion
            ? `Lv.${companion.level} ${getCompanionTypeName(companion.type)}`
            : "データなし",
          rarity: companion?.rarity || "Common",
        };
      }).filter((member): member is NonNullable<typeof member> => Boolean(member)),
    [formationIds, hero, currentRun, team]
  );

  const totalCandidatePages = Math.max(
    1,
    Math.ceil(ownedCompanions.length / CANDIDATES_PER_PAGE)
  );

  const isInTeam = (companionId: string) =>
    team.some((c) => c.id === companionId);

  const toggleTeamMember = (companion: Companion) => {
    if (!currentRun || !hero) return;
    let nextTeam: Companion[] = [];
    let nextFormationIds: string[] = [];

    if (isInTeam(companion.id)) {
      nextTeam = team.filter((c) => c.id !== companion.id);
      nextFormationIds = normalizeBattleFormationIds(
        hero.id,
        nextTeam,
        formationIds.filter((id) => id !== companion.id)
      );
    } else {
      if (team.length >= 2) return;
      nextTeam = [...team, companion];
      nextFormationIds = normalizeBattleFormationIds(
        hero.id,
        nextTeam,
        [...formationIds, companion.id]
      );
    }

    setTeam(nextTeam);
    setBattleFormation(nextFormationIds);
  };

  const moveFormationMember = (from: number, to: number) => {
    if (!currentRun || !hero) return;
    if (
      from < 0 ||
      to < 0 ||
      from >= formationIds.length ||
      to >= formationIds.length
    ) {
      return;
    }

    const next = [...formationIds];
    [next[from], next[to]] = [next[to], next[from]];
    setBattleFormation(next);
  };

  const clampedCandidatePage = Math.min(candidatePage, totalCandidatePages - 1);
  const pageStart = clampedCandidatePage * CANDIDATES_PER_PAGE;
  const currentCandidates = ownedCompanions.slice(
    pageStart,
    pageStart + CANDIDATES_PER_PAGE
  );

  if (!currentRun || !hero) return null;

  return (
    <ScreenLayout bgImage="/orgamon-quest/images/backgrounds/team_bg.webp"
      onBack={() => setScreen("home")}
      title="チーム編成"
      titleEmoji="👥"
      accentColor={hero.themeColor}
      padding="compact"
      className="min-h-[100dvh] flex flex-col pb-[calc(env(safe-area-inset-bottom)+0.25rem)]"
    >
      <div className="flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
        <GlassCard variant="strong" className="p-3 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-warm-gray">並び順（1〜3番手）</h3>
            <Badge variant="warning" size="sm" className="max-w-[55%] truncate">
              {formationMembers[0]?.name || "未設定"} がリーダー
            </Badge>
          </div>
          <p className="text-xs text-indigo-700/80 mb-2">
            リーダーを含めて上下移動できます。番手ごとに能力補正が変わります。
          </p>
          <div className="grid grid-cols-3 gap-2">
            {formationMembers.map((member, index) => (
              <div key={member.id} className="rounded-xl bg-white/65 border border-white/70 p-2">
                <div className="flex items-center justify-between">
                  {member.imageUrl ? (
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-white/50 shadow-sm shrink-0">
                      <img src={member.imageUrl} alt={member.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <span className="text-base">{member.emoji}</span>
                  )}
                  <Badge variant="info" size="xs">{POSITION_LABELS[index] || `${index + 1}番手`}</Badge>
                </div>
                <p className="text-sm font-bold text-warm-gray truncate mt-1">{member.name}</p>
                <p className="text-xs text-warm-gray/45 truncate">{member.subLabel}</p>
                <p className="text-xs text-indigo-600/75 mt-0.5">{POSITION_EFFECT_LABELS[index]}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <button
                    onClick={() => moveFormationMember(index, index - 1)}
                    disabled={index === 0}
                    className={`flex-1 min-h-8 text-xs rounded-md py-1.5 font-bold ${index === 0 ? "bg-gray-100 text-warm-gray/30" : "bg-sky-100 text-sky-700 btn-press"
                      }`}
                  >
                    ↑ 上へ
                  </button>
                  <button
                    onClick={() => moveFormationMember(index, index + 1)}
                    disabled={index >= formationMembers.length - 1}
                    className={`flex-1 min-h-8 text-xs rounded-md py-1.5 font-bold ${index >= formationMembers.length - 1
                      ? "bg-gray-100 text-warm-gray/30"
                      : "bg-sky-100 text-sky-700 btn-press"
                      }`}
                  >
                    ↓ 下へ
                  </button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-3 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-warm-gray">仲間選択</h3>
            <p className="text-xs text-warm-gray/45">{clampedCandidatePage + 1}/{totalCandidatePages} ページ</p>
          </div>

          {ownedCompanions.length === 0 ? (
            <div className="flex-1 grid place-items-center text-center">
              <div>
                <div className="text-3xl mb-2">🔍</div>
                <p className="text-sm text-warm-gray/40">仲間がまだいません</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 grid grid-rows-2 gap-2">
                {currentCandidates.map((comp) => {
                  const inTeam = isInTeam(comp.id);
                  const teamFull = team.length >= 2;
                  const disabled = !inTeam && teamFull;
                  return (
                    <button
                      key={comp.id}
                      onClick={() => toggleTeamMember(comp)}
                      disabled={disabled}
                      className={`text-left rounded-xl p-3 min-h-[76px] transition-all ${inTeam
                        ? "bg-pastel-green/20 border-2 border-green-300/50"
                        : disabled
                          ? "bg-gray-100/60 opacity-40"
                          : "bg-white/60 hover:bg-white/80 btn-press border border-white/70"
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0"
                          style={{ backgroundColor: rarityColor[comp.rarity] + "25" }}
                        >
                          {(comp.imageUrl || (comp.type === "hero" ? heroes.find(h => h.id === comp.heroRef)?.imageUrl : undefined)) ? (
                            <img src={comp.imageUrl || (comp.type === "hero" ? heroes.find(h => h.id === comp.heroRef)?.imageUrl : undefined)} alt={comp.name} className="w-full h-full object-cover rounded-full shadow-sm" />
                          ) : (
                            <>{typeEmoji[comp.type] || "👤"}</>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="text-base font-bold text-warm-gray truncate">{comp.name}</p>
                            <Badge variant="rarity" size="xs" color={rarityColor[comp.rarity]}>
                              {comp.rarity}
                            </Badge>
                            {inTeam && <Badge variant="success" size="xs">編成中</Badge>}
                          </div>
                          <p className="text-xs text-warm-gray/50 truncate">
                            Lv.{comp.level} {getCompanionTypeName(comp.type)}
                          </p>
                          <p className="text-xs text-warm-gray/45">
                            A{comp.baseStats.atk} D{comp.baseStats.def} S{comp.baseStats.spd ?? 12}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {currentCandidates.length < CANDIDATES_PER_PAGE && (
                  <div className="rounded-xl border-2 border-dashed border-gray-200/50 grid place-items-center text-xs text-warm-gray/25">
                    候補なし
                  </div>
                )}
              </div>

              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => setCandidatePage((prev) => Math.max(0, Math.min(prev, totalCandidatePages - 1) - 1))}
                  disabled={clampedCandidatePage === 0}
                  className={`flex-1 min-h-10 rounded-lg text-sm font-bold ${clampedCandidatePage === 0
                    ? "bg-gray-100 text-warm-gray/30"
                    : "bg-indigo-100/70 text-indigo-700 btn-press"
                    }`}
                >
                  ← 前へ
                </button>
                <button
                  onClick={() =>
                    setCandidatePage((prev) =>
                      Math.min(totalCandidatePages - 1, Math.min(prev, totalCandidatePages - 1) + 1)
                    )
                  }
                  disabled={clampedCandidatePage >= totalCandidatePages - 1}
                  className={`flex-1 min-h-10 rounded-lg text-sm font-bold ${clampedCandidatePage >= totalCandidatePages - 1
                    ? "bg-gray-100 text-warm-gray/30"
                    : "bg-indigo-100/70 text-indigo-700 btn-press"
                    }`}
                >
                  次へ →
                </button>
              </div>
            </>
          )}
        </GlassCard>
      </div>

      <div className="shrink-0">
        <PastelButton fullWidth size="lg" gradient="coral" icon="✅" onClick={() => setScreen("chapter_map")}>
          編成確定
        </PastelButton>
      </div>
    </ScreenLayout>
  );
}
