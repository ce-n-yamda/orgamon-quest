import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useGameStore } from "../stores/gameStore";
import { useDailyStore } from "../stores/dailyStore";
import { useCollectionStore } from "../stores/collectionStore";
import { useMetaStore } from "../stores/metaStore";
import { getRandomQuestionsGuaranteed, applyReduceChoices } from "../logic/quizLogic";
import { getBossByChapter, calcBossDamage, getBossCounterAttack, getInitialHomeostasis, isBossDefeated, isBattleCleared, BATTLE_ROUNDS } from "../logic/battleLogic";
import { checkTeamCombo, applyComboEffects, getComboBonus } from "../logic/comboLogic";
import { canUseSkill, applySkillEffects, getHeroById, getHeroSkillLoadout } from "../logic/skillLogic";
import { buildFormation, buildSpeedTurnQueue, getPartyDefense, POSITION_LABELS } from "../logic/formationLogic";
import { ProgressBar, Badge, Modal, PastelButton, ParticleEffect } from "../components/common";
import { audio } from "../utils/audio";
import cardsData from "../data/cards.json";
import type { Question, Skill, Card } from "../types";

const allCards = cardsData as Card[];
const BASE_TIME_LIMIT = 25;

const companionTypeEmoji: Record<string, string> = {
  nurse: "💉",
  researcher: "📊",
  guardian: "🛡️",
  hero: "⭐",
};

function getDebuffLabel(type: string): string {
  switch (type) {
    case "observation_miss":
      return "👁️ 観察ミス";
    case "misinformation":
      return "❌ 誤情報";
    case "time_pressure":
      return "⏰ 時間圧迫";
    case "equipment_malfunction":
      return "🔧 機器故障";
    default:
      return "🔧 デバフ";
  }
}

export default function BattleScreen() {
  const currentRun = useGameStore((s) => s.currentRun);
  const difficulty = useGameStore((s) => s.difficulty);
  const setScreen = useGameStore((s) => s.setScreen);
  const addXP = useGameStore((s) => s.addXP);
  const addMP = useGameStore((s) => s.addMP);
  const addHomeostasis = useGameStore((s) => s.addHomeostasis);
  const setHomeostasis = useGameStore((s) => s.setHomeostasis);
  const addDebuff = useGameStore((s) => s.addDebuff);
  const removeDebuff = useGameStore((s) => s.removeDebuff);
  const tickDebuffs = useGameStore((s) => s.tickDebuffs);
  const tickBuffs = useGameStore((s) => s.tickBuffs);
  const tickCooldowns = useGameStore((s) => s.tickCooldowns);
  const triggerSkillCooldown = useGameStore((s) => s.useSkill);
  const addUltimateCharge = useGameStore((s) => s.addUltimateCharge);
  const resetUltimateCharge = useGameStore((s) => s.resetUltimateCharge);
  const addBuff = useGameStore((s) => s.addBuff);
  const addCard = useGameStore((s) => s.addCard);
  const addItem = useGameStore((s) => s.addItem);
  const defeatBoss = useGameStore((s) => s.defeatBoss);
  const progressMission = useDailyStore((s) => s.progressMission);
  const mergeFromCurrentRun = useCollectionStore((s) => s.mergeFromCurrentRun);
  const incrementClears = useMetaStore((s) => s.incrementClears);
  const activeTitle = useMetaStore((s) => s.meta.activeTitle);

  const gameState = useGameStore.getState() as Record<string, unknown>;
  const chapter = (gameState._battleChapter as number) || 1;
  const boss = getBossByChapter(chapter);
  const hero = currentRun ? getHeroById(currentRun.selectedHeroId) : null;
  const combo = currentRun ? checkTeamCombo(currentRun.selectedHeroId, currentRun.team) : null;
  const equippedSkills =
    currentRun && hero ? getHeroSkillLoadout(hero, currentRun).equippedSkills : [];
  const formation = useMemo(() => {
    if (!hero || !currentRun) return [];
    return buildFormation(hero, currentRun.team, activeTitle, currentRun.battleFormationIds);
  }, [hero, currentRun, activeTitle]);
  const turnQueue = useMemo(() => buildSpeedTurnQueue(formation, BATTLE_ROUNDS + 4), [formation]);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [round, setRound] = useState(0);
  const [bossHp, setBossHp] = useState(boss?.hp || 300);
  const [maxBossHp] = useState(boss?.hp || 300);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [battleFinished, setBattleFinished] = useState(false);
  const [battleResult, setBattleResult] = useState<"win" | "lose" | null>(null);
  const [timeLeft, setTimeLeft] = useState(BASE_TIME_LIMIT);
  const [showSkillPanel, setShowSkillPanel] = useState(false);
  const [skillMessage, setSkillMessage] = useState<string | null>(null);
  const [comboMessage, setComboMessage] = useState<string | null>(null);
  const [turnMessage, setTurnMessage] = useState<string | null>(null);
  const [damagedMemberId, setDamagedMemberId] = useState<string | null>(null);
  const [displayChoices, setDisplayChoices] = useState<string[]>([]);
  const [displayAnswerIdx, setDisplayAnswerIdx] = useState(0);
  const [damageAnim, setDamageAnim] = useState(0);
  const [hintKeyword, setHintKeyword] = useState<string | null>(null);
  const [safeNet, setSafeNet] = useState(false);
  const [maskedText, setMaskedText] = useState(false);
  const [fakeHighlight, setFakeHighlight] = useState<number | null>(null);
  const [showVictoryParticles, setShowVictoryParticles] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    audio.playBGM("battle");
    if (!boss || !currentRun) return;
    setQuestions(getRandomQuestionsGuaranteed(chapter, BATTLE_ROUNDS, "confirm"));
    setHomeostasis(getInitialHomeostasis(difficulty));
    progressMission("boss_challenge");
  }, [chapter, boss]);

  const initRoundRef = useRef(-1);
  useEffect(() => {
    if (!currentRun || questions.length === 0 || round >= questions.length) return;
    const q = questions[round];
    if (initRoundRef.current !== round) {
      initRoundRef.current = round;
      setDisplayChoices([...q.choices]);
      setDisplayAnswerIdx(q.answerIndex);
      setHintKeyword(null);
      setFakeHighlight(null);
      const hasTP = currentRun.debuffs.some((d) => d.type === "time_pressure");
      let time = hasTP ? Math.ceil(BASE_TIME_LIMIT / 2) : BASE_TIME_LIMIT;
      if (hero?.passive?.effects) { const ext = hero.passive.effects.find((e) => e.type === "time_extend"); if (ext) time = Math.ceil(time * (1 + ext.value / 100)); }
      setTimeLeft(time);

      if (currentRun.debuffs.some((d) => d.type === "misinformation")) {
        const wi = q.choices.map((_, i) => i).filter((i) => i !== q.answerIndex);
        if (wi.length > 0) setFakeHighlight(wi[Math.floor(Math.random() * wi.length)]);
      }
    }

    setMaskedText(currentRun.debuffs.some((d) => d.type === "observation_miss"));
    if (!currentRun.debuffs.some((d) => d.type === "misinformation")) {
      setFakeHighlight(null);
    }
  }, [round, questions, currentRun, hero]);

  useEffect(() => {
    if (battleFinished || showResult || questions.length === 0) return;
    timerRef.current = setInterval(() => { setTimeLeft((p) => { if (p <= 1) { handleAnswer(-1); return 0; } return p - 1; }); }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [showResult, battleFinished, round, questions]);

  const handleAnswer = useCallback((choiceIdx: number) => {
    if (showResult || battleFinished || questions.length === 0) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const correct = choiceIdx === displayAnswerIdx;
    const actorId = turnQueue[round] || formation[0]?.id;
    const actingMember = formation.find((member) => member.id === actorId) || formation[0];
    const attackerAtk = actingMember?.effectiveStats.atk || 0;
    const averagedDefense = getPartyDefense(formation);
    setSelectedAnswer(choiceIdx); setIsCorrect(correct); setShowResult(true);
    if (correct) {
      addUltimateCharge(1);
      const comboBonus = combo ? getComboBonus(combo) : 0;
      const damage = calcBossDamage(true, currentRun?.ownedCards || {}, allCards, comboBonus, attackerAtk);
      setBossHp((prev) => Math.max(0, prev - damage));
      setDamageAnim(damage);
      if (damage >= 40) audio.playSE("heavy_impact");
      else audio.playSE("impact");
      setTimeout(() => setDamageAnim(0), 800);
      setTurnMessage(`⚔️ ${actingMember?.name || "味方"} の行動！ ${damage}ダメージ`);
      setTimeout(() => setTurnMessage(null), 1800);
      if (combo) {
        const comboFx = applyComboEffects(combo);
        if (comboFx.healHomeostasis > 0) addHomeostasis(comboFx.healHomeostasis);
        setComboMessage(`💥 コンボ発動: ${combo.name}！`);
        setTimeout(() => setComboMessage(null), 2000);
      }
      if (currentRun?.activeBuffs?.some((b) => b.type === "hot_heal")) {
        const hotBuff = currentRun.activeBuffs.find((b) => b.type === "hot_heal");
        if (hotBuff) addHomeostasis(hotBuff.value);
      }
    } else {
      if (!safeNet && boss) {
        const counter = getBossCounterAttack(boss, round, difficulty, averagedDefense);
        addHomeostasis(-counter.homeostasisDamage);
        if (counter.isDeflected) audio.playSE("deflect");
        else if (counter.homeostasisDamage >= 15) audio.playSE("heavy_player_damage");
        else audio.playSE("player_damage");
        counter.debuffs.forEach((d) => addDebuff(d));
        const target = formation.length > 0
          ? formation[(round + 1) % formation.length]
          : null;
        if (target) {
          setDamagedMemberId(target.id);
          setTimeout(() => setDamagedMemberId(null), 900);
        }
        setTurnMessage(
          target
            ? `🛡️ ${target.name} が被弾（軽減後 -${counter.homeostasisDamage}）`
            : `🛡️ 防御連携で被ダメ軽減: -${counter.homeostasisDamage}`
        );
        setTimeout(() => setTurnMessage(null), 1800);
      }
      if (safeNet) {
        setTurnMessage("🛡️ セーフティネットで反撃を無効化");
        setTimeout(() => setTurnMessage(null), 1800);
      }
      setSafeNet(false);
    }
  }, [showResult, battleFinished, questions, displayAnswerIdx, currentRun, boss, combo, round, difficulty, safeNet, formation, turnQueue]);

  const handleNext = () => {
    setShowResult(false); setSelectedAnswer(null); tickCooldowns(); tickDebuffs(); tickBuffs();
    if (bossHp <= 0 || round + 1 >= questions.length) finishBattle();
    else setRound((r) => r + 1);
  };

  const finishBattle = () => {
    setBattleFinished(true);
    const homeostasis = currentRun?.homeostasis || 0;
    const bossDown = isBossDefeated(bossHp);
    const cleared = isBattleCleared(homeostasis) && bossDown;
    if (cleared) {
      setBattleResult("win"); setShowVictoryParticles(true);
      defeatBoss(chapter);
      progressMission("chapter_clear");
      if (boss) { addMP(boss.rewards.mp); addXP(boss.rewards.mp / 2); if (boss.rewards.cardId) addCard(boss.rewards.cardId); boss.rewards.items.forEach((itemId) => addItem(itemId)); }
      const updatedRun = useGameStore.getState().currentRun;
      if (updatedRun) mergeFromCurrentRun(updatedRun);
      if (chapter === 9) incrementClears();
    } else { setBattleResult("lose"); addXP(20); }
    useGameStore.setState((s) => ({ ...s, _battleResult: { chapter, won: cleared, bossDefeated: bossDown, homeostasis, bossHpRemaining: bossHp, rewards: cleared && boss ? boss.rewards : null } } as typeof s));
  };

  const handleUseSkill = (skill: Skill) => {
    if (!currentRun || !hero) return;
    if (!canUseSkill(skill.id, currentRun.skillCooldowns, currentRun.ultimateCharge, skill)) return;
    const result = applySkillEffects(skill.effects, currentRun.debuffs);
    if (skill.type === "active") triggerSkillCooldown(skill.id, skill.cooldown);
    else if (skill.type === "ultimate") { triggerSkillCooldown(skill.id, 99); resetUltimateCharge(); }
    progressMission("skill_use_2");
    progressMission("skill_use_3");
    if (result.healHomeostasis > 0) addHomeostasis(result.healHomeostasis);
    result.cleansedDebuffs.forEach((d) => removeDebuff(d));
    let reducedFrom: number | null = null;
    let reducedTo: number | null = null;
    if (result.reducedChoicesBy > 0 && displayChoices.length > 2) {
      reducedFrom = displayChoices.length;
      const r = applyReduceChoices(displayChoices, displayAnswerIdx, result.reducedChoicesBy);
      setDisplayChoices(r.filteredChoices);
      setDisplayAnswerIdx(r.newAnswerIndex);
      reducedTo = r.filteredChoices.length;
    }
    if (result.showHint && questions[round]?.keywords?.length) setHintKeyword(questions[round].keywords![0]);
    if (result.safeNet) setSafeNet(true);
    if (result.autoHighlightTurns > 0) addBuff({ type: "auto_highlight", value: 1, turnsRemaining: result.autoHighlightTurns });
    result.newBuffs.forEach((b) => addBuff(b));
    if (result.reducedCooldowns > 0) { for (let i = 0; i < result.reducedCooldowns; i++) tickCooldowns(); }
    const choiceReducedLabel =
      reducedFrom !== null && reducedTo !== null
        ? `（選択肢 ${reducedFrom}→${reducedTo}）`
        : "";
    setSkillMessage(`✨ ${skill.name} 発動！${choiceReducedLabel}`);
    setTimeout(() => setSkillMessage(null), 1500);
    setShowSkillPanel(false);
  };

  if (!currentRun || !hero || !boss || questions.length === 0) {
    return (
      <div className="h-[100dvh] flex items-center justify-center">
        <div className="text-center"><div className="text-5xl mb-4 animate-float">⚔️</div><p className="text-warm-gray/50 text-sm">ボス戦準備中...</p></div>
      </div>
    );
  }

  if (battleFinished) {
    const won = battleResult === "win";
    return (
      <div className="h-[100dvh] px-4 py-6 flex flex-col items-center justify-center relative overflow-hidden">
        <ParticleEffect type={won ? "confetti" : "stars"} active={showVictoryParticles} count={won ? 20 : 8} />
        <div className="text-center relative z-10 animate-pop">
          <div className="text-7xl mb-4">{won ? "🏆" : "😢"}</div>
          <h1 className={`text-2xl font-extrabold mb-2 ${won ? "text-gradient-gold" : "text-warm-gray"}`}>
            {won ? "ボス撃破！" : "惜しくも敗北..."}
          </h1>
          <p className="text-sm text-warm-gray/50 mb-2">vs {boss.name} (Ch.{chapter})</p>
          <p className="text-sm text-warm-gray/50">ホメオスタシス: {currentRun.homeostasis}/100{!won && " (70以上でクリア)"}</p>
        </div>
        {won && boss.rewards && (
          <div className="w-full glass-strong rounded-2xl p-5 shadow-md mt-6 relative z-10 animate-slide-up">
            <h3 className="text-sm font-bold text-warm-gray mb-3">🎁 撃破報酬</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-pastel-blue/20 rounded-xl p-3 text-center"><p className="text-xs text-warm-gray/40">MP</p><p className="text-lg font-bold text-blue-600">+{boss.rewards.mp}</p></div>
              {boss.rewards.cardId && <div className="bg-pastel-yellow/20 rounded-xl p-3 text-center"><p className="text-xs text-warm-gray/40">カード</p><p className="text-sm font-bold text-amber-600">🃏 ボスカード</p></div>}
            </div>
            {boss.rewards.items.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">{boss.rewards.items.map((itemId, i) => <Badge key={i} variant="success" size="xs" icon="🎁">{itemId}</Badge>)}</div>
            )}
          </div>
        )}
        <div className="w-full space-y-3 mt-6 relative z-10">
          {won ? (
            <PastelButton fullWidth size="lg" gradient="coral" icon="📖" onClick={() => {
              useGameStore.setState((s) => ({ ...s, _storyChapter: chapter, _storyTiming: chapter === 9 ? "game_ending" : "post_boss" } as typeof s));
              audio.playBGM("map");
              setScreen("story");
            }}>ストーリーを見る →</PastelButton>
          ) : (
            <>
              <PastelButton fullWidth size="lg" gradient="coral" icon="🔄" onClick={() => {
                setBattleFinished(false); setBattleResult(null); setRound(0); setBossHp(boss.hp);
                setQuestions(getRandomQuestionsGuaranteed(chapter, BATTLE_ROUNDS, "confirm")); setHomeostasis(getInitialHomeostasis(difficulty));
              }}>再挑戦</PastelButton>
              <PastelButton fullWidth variant="secondary" icon="🗺️" onClick={() => { audio.playBGM("map"); setScreen("chapter_map"); }}>章マップへ</PastelButton>
            </>
          )}
          <PastelButton fullWidth variant="ghost" icon="🏠" onClick={() => { audio.playBGM("title"); setScreen("home"); }}>ホームへ</PastelButton>
        </div>
      </div>
    );
  }

  const q = questions[round];
  const homeostasisPercent = Math.max(0, currentRun.homeostasis);
  const totalRounds = questions.length || BATTLE_ROUNDS;
  const currentAttackerId = turnQueue[round] || formation[0]?.id;
  const currentAttacker = formation.find((member) => member.id === currentAttackerId) || formation[0];
  const partyDefense = getPartyDefense(formation);
  const getFormationEmoji = (memberId: string) => {
    const member = formation.find((unit) => unit.id === memberId);
    if (!member) return null;
    if (member.role === "hero") return null; // use image instead
    return companionTypeEmoji[member.companionType || "hero"] || "👤";
  };
  const getFormationImage = (memberId: string) => {
    const member = formation.find((unit) => unit.id === memberId);
    if (!member) return null;
    if (member.role === "hero") {
      return getHeroById(member.id as any)?.imageUrl || null;
    }
    const comp = currentRun?.team.find((c) => c.id === member.id);
    return comp?.imageUrl || null;
  };


  return (
    <div className="min-h-[100dvh] overflow-y-auto overflow-x-hidden px-3 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+0.4rem)] flex flex-col gap-1.5 relative">
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center opacity-40 mix-blend-multiply"
        style={{ backgroundImage: `url('/images/backgrounds/chapter_${chapter}.webp'), linear-gradient(to bottom right, #fdfbfb, #ebedee)` }}
      />
      {/* Boss info */}
      <div className="bg-gradient-to-r from-red-50/80 to-orange-50/80 backdrop-blur rounded-2xl p-3 shadow-sm border border-red-100/50">
        <div className="flex items-center gap-2.5 mb-2">
          <div className={`w-12 h-12 rounded-xl bg-red-100/60 overflow-hidden flex items-center justify-center shrink-0 shadow-sm ${damageAnim > 0 ? "animate-shake bg-red-300 border border-red-400" : "border border-red-200"}`}>
            {boss.imageUrl ? <img src={boss.imageUrl} alt={boss.name} className="w-full h-full object-cover" /> : <span className="text-xl">👹</span>}
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm text-warm-gray">{boss.name}</p>
            <p className="text-xs text-warm-gray/40">Ch.{chapter} ボス</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-warm-gray/40">ROUND</p>
            <p className="font-bold text-sm text-warm-gray">{round + 1}/{totalRounds}</p>
          </div>
        </div>
        <ProgressBar value={bossHp} max={maxBossHp} gradient="from-red-400 to-orange-400" size="sm" showLabel label="HP" />
        {damageAnim > 0 && <div className="text-center mt-1"><span className="text-red-500 font-bold text-sm animate-pop inline-block">-{damageAnim} HP!</span></div>}
      </div>

      {/* Player stats */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <ProgressBar value={homeostasisPercent} max={100} color={homeostasisPercent >= 70 ? "#98d4bb" : homeostasisPercent >= 40 ? "#f0c040" : "#f08080"} size="sm" showLabel label="💓 ホメオスタシス" striped={homeostasisPercent < 70} />
        </div>
        <div className={`min-w-16 px-2.5 py-1.5 rounded-lg text-sm font-bold shrink-0 text-center ${timeLeft <= 5 ? "bg-red-100 text-red-500 animate-pulse" : "glass text-warm-gray"}`}>⏱️ {timeLeft}s</div>
      </div>

      {/* Status */}
      {currentRun.debuffs.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {currentRun.debuffs.map((d, i) => (
            <Badge key={i} variant="danger" size="xs">
              {getDebuffLabel(d.type)} {d.duration}T
            </Badge>
          ))}
        </div>
      )}
      {comboMessage && <div className="text-center py-1.5 bg-gradient-to-r from-pastel-yellow/60 to-pastel-pink/60 rounded-xl text-[13px] font-bold text-amber-700 animate-pulse">{comboMessage}</div>}
      {skillMessage && <div className="text-center py-1.5 bg-pastel-yellow/60 rounded-xl text-[13px] font-bold text-amber-700 animate-pop">{skillMessage}</div>}
      {turnMessage && <div className="text-center py-1.5 bg-pastel-blue/35 rounded-xl text-xs font-bold text-blue-700 animate-pop">{turnMessage}</div>}
      {hintKeyword && <div className="text-center py-1.5 bg-pastel-blue/40 rounded-xl text-xs font-medium text-blue-700">💡 ヒント: 「{hintKeyword}」に注目！</div>}
      {fakeHighlight !== null && !showResult && (
        <div className="text-center py-1.5 bg-yellow-100/80 border border-yellow-300/80 rounded-xl text-xs font-semibold text-amber-700">
          ⚠️ 黄枠は「誤情報」デバフのミスリードです。正解とは限りません。
        </div>
      )}

      {formation.length > 0 && (
        <div className="glass rounded-2xl p-2 border border-white/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-warm-gray">👥 味方フォーメーション</p>
            <p className="text-xs text-warm-gray/45">平均DEF {partyDefense}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {formation.map((member) => {
              const isCurrentTurn = member.id === currentAttacker?.id;
              const isDamaged = member.id === damagedMemberId;
              return (
                <div
                  key={member.id}
                  className={`rounded-xl p-2 border transition-all ${isCurrentTurn
                    ? "bg-amber-50/80 border-amber-300 shadow-sm"
                    : "bg-white/60 border-white/70"
                    } ${isDamaged ? "bg-red-100/80 border-red-300 animate-shake" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    {getFormationImage(member.id) ? (
                      <div className="w-7 h-7 rounded-full overflow-hidden shadow-sm">
                        <img src={getFormationImage(member.id)!} alt={member.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <span className="text-base">{getFormationEmoji(member.id)}</span>
                    )}
                    <span className="text-sm text-warm-gray/45">{POSITION_LABELS[member.slot] || `${member.slot + 1}番手`}</span>
                  </div>
                  <p className="text-sm font-semibold text-warm-gray truncate">{member.name}</p>
                  <p className="text-sm text-warm-gray/50">A{member.effectiveStats.atk} D{member.effectiveStats.def} S{member.effectiveStats.spd}</p>
                  {isDamaged && <p className="text-sm font-bold text-red-500 mt-0.5">被弾!</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Question */}
      <div className="glass-strong rounded-2xl p-3 shadow-md">
        <p className={`text-[15px] font-medium text-warm-gray leading-relaxed ${maskedText ? "blur-[2px] hover:blur-none transition-all" : ""}`}>{q.question}</p>
      </div>

      {/* Choices */}
      <div className="flex-1 min-h-0 flex flex-col gap-2 pb-1 pt-1">
        {displayChoices.map((choice, idx) => {
          const isSelected = selectedAnswer === idx;
          const isAnswer = idx === displayAnswerIdx;
          let bgClass = "glass hover:bg-white/80 border-2 border-transparent";
          if (showResult) {
            if (isAnswer) bgClass = "bg-green-100/80 border-2 border-green-400";
            else if (isSelected && !isAnswer) bgClass = "bg-red-100/80 border-2 border-red-400 animate-shake";
            else bgClass = "bg-white/30 border-2 border-transparent opacity-50";
          } else if (fakeHighlight === idx) bgClass = "bg-yellow-100/70 hover:bg-yellow-200/70 border-2 border-yellow-400";
          return (
            <button key={idx} onClick={() => !showResult && handleAnswer(idx)} disabled={showResult}
              className={`w-full text-left p-3 rounded-xl transition-all duration-200 ${bgClass} ${!showResult ? "btn-press" : ""}`}>
              <div className="flex items-start gap-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${showResult && isAnswer ? "bg-green-400 text-white" : showResult && isSelected ? "bg-red-400 text-white" : "bg-gray-200/80 text-warm-gray"}`}>{idx + 1}</span>
                <span className="text-sm text-warm-gray leading-relaxed">{choice}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {showResult && (
        <div className={`rounded-xl p-3 mb-2 animate-slide-up ${isCorrect ? "bg-green-50/80 border border-green-200" : "bg-red-50/80 border border-red-200"}`}>
          <p className={`font-bold text-xs mb-1 ${isCorrect ? "text-green-600" : "text-red-500"}`}>{isCorrect ? "🎉 正解！ ボスにダメージ！" : "😢 不正解... ボスの反撃！"}</p>
          <p className="text-xs text-warm-gray/60 leading-relaxed">{q.explanation}</p>
        </div>
      )}

      {/* Bottom */}
      <div className="flex gap-2 pt-0.5">
        {!showResult ? (
          <button onClick={() => setShowSkillPanel(!showSkillPanel)} className="flex-1 min-h-12 py-3 bg-gradient-to-r from-lavender/80 to-pastel-purple/80 text-white rounded-xl font-bold shadow-sm text-base btn-press">⚡ スキル</button>
        ) : (
          <button onClick={handleNext} className="flex-1 min-h-12 py-3 bg-gradient-to-r from-coral to-pastel-pink text-white rounded-xl font-bold shadow-md text-base btn-press">{round + 1 >= totalRounds || bossHp <= 0 ? "結果を見る →" : "次のラウンド →"}</button>
        )}
      </div>

      {/* Skill panel */}
      <Modal
        open={showSkillPanel && !showResult}
        onClose={() => setShowSkillPanel(false)}
        position="bottom"
        showHandle
        className="pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
      >
        <h3 className="font-bold text-warm-gray mb-3">⚡ スキル選択</h3>
        <div className="bg-pastel-yellow/20 rounded-xl p-3 mb-3">
          <div className="flex items-center justify-between text-xs mb-1"><span className="font-medium text-warm-gray">🌈 アルティメット</span><span className="font-bold text-amber-600">{currentRun.ultimateCharge}/{hero.ultimate.chargeRequired || 5}</span></div>
          <ProgressBar value={currentRun.ultimateCharge || 0} max={hero.ultimate.chargeRequired || 5} gradient="from-amber-400 to-yellow-300" size="sm" />
          <p className="text-xs text-warm-gray/45 mt-1">
            正解1回ごとに+1。必要値に達するとアルティメットを使用できます。
          </p>
        </div>
        {combo && <div className="bg-pastel-pink/15 rounded-xl p-2 mb-3 border border-pink-200/40"><p className="text-xs font-bold text-pink-600">💥 コンボ: {combo.name}</p><p className="text-xs text-warm-gray/40">{combo.description}</p></div>}
        <div className="space-y-2 pb-2">
          {(currentAttacker?.id === hero?.id ? equippedSkills : (currentRun?.team.find(c => c.id === currentAttacker?.id)?.skills || [])).map((skill) => {
            const cd = currentRun.skillCooldowns[skill.id] || 0;
            const usable = canUseSkill(skill.id, currentRun.skillCooldowns, currentRun.ultimateCharge, skill);
            return (
              <button key={skill.id} onClick={() => usable && handleUseSkill(skill)} disabled={!usable}
                className={`w-full min-h-14 text-left p-3 rounded-xl transition-all ${usable ? "bg-white/80 hover:bg-white shadow-sm btn-press" : "bg-gray-100/60 opacity-40"}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm" style={{ backgroundColor: cd > 0 ? "#ccc" : hero.themeColor }}>{cd > 0 ? `CD${cd}` : "⚡"}</div>
                  <div className="flex-1 min-w-0"><p className="font-bold text-sm text-warm-gray">{skill.name}</p><p className="text-xs text-warm-gray/40 truncate">{skill.description}</p></div>
                </div>
              </button>
            );
          })}
          {currentAttacker?.id === hero?.id && (
            <button onClick={() => { if (canUseSkill(hero.ultimate.id, currentRun.skillCooldowns, currentRun.ultimateCharge, hero.ultimate)) handleUseSkill(hero.ultimate); }}
              disabled={!canUseSkill(hero.ultimate.id, currentRun.skillCooldowns, currentRun.ultimateCharge, hero.ultimate)}
              className={`w-full min-h-14 text-left p-3 rounded-xl border-2 border-dashed transition-all ${canUseSkill(hero.ultimate.id, currentRun.skillCooldowns, currentRun.ultimateCharge, hero.ultimate) ? "border-amber-300 bg-amber-50/80 hover:bg-amber-100 btn-press" : "border-gray-200 bg-gray-50/60 opacity-40"}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-300 flex items-center justify-center text-white text-lg shrink-0 shadow-sm">🌈</div>
                <div className="flex-1 min-w-0"><p className="font-bold text-sm text-warm-gray">{hero.ultimate.name}</p><p className="text-xs text-warm-gray/40 truncate">{hero.ultimate.description}</p></div>
              </div>
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}
