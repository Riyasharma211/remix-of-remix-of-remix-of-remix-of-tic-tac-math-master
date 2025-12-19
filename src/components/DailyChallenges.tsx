import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { X, Trophy, Calendar, Flame, Gift } from 'lucide-react';
import { useDailyChallenges, DailyChallenge, WeeklyQuest } from '@/hooks/useDailyChallenges';
import { haptics } from '@/utils/haptics';
import { soundManager } from '@/utils/soundManager';

interface DailyChallengesProps {
  isOpen: boolean;
  onClose: () => void;
}

const DailyChallenges: React.FC<DailyChallengesProps> = ({ isOpen, onClose }) => {
  const { challenges, weeklyQuest, streak, totalRewards, getCompletedCount } = useDailyChallenges();
  const completedCount = getCompletedCount();

  if (!isOpen) return null;

  const ChallengeCard = ({ challenge }: { challenge: DailyChallenge }) => (
    <div
      className={`p-4 rounded-xl border-2 transition-all ${
        challenge.completed
          ? 'bg-neon-green/10 border-neon-green/50 opacity-75'
          : 'bg-card/50 border-border hover:border-neon-cyan/50'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{challenge.icon}</span>
          <div>
            <h3 className="font-orbitron text-sm font-semibold text-foreground">
              {challenge.title}
            </h3>
            <p className="text-xs text-muted-foreground font-rajdhani">
              {challenge.description}
            </p>
          </div>
        </div>
        {challenge.completed && (
          <div className="text-neon-green">
            <Trophy className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-rajdhani">
            {challenge.progress} / {challenge.target}
          </span>
          <span className="font-orbitron text-neon-cyan">
            +{challenge.reward} pts
          </span>
        </div>
        <Progress
          value={(challenge.progress / challenge.target) * 100}
          className={`h-2 ${
            challenge.completed ? 'bg-neon-green/20' : ''
          }`}
        />
      </div>
    </div>
  );

  const QuestCard = ({ quest }: { quest: WeeklyQuest }) => (
    <div
      className={`p-4 rounded-xl border-2 bg-gradient-to-br ${
        quest.completed
          ? 'from-neon-green/20 to-neon-cyan/20 border-neon-green/50'
          : 'from-neon-purple/10 to-neon-pink/10 border-neon-purple/50'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{quest.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-orbitron text-base font-bold text-foreground">
                {quest.title}
              </h3>
              <span className="text-xs bg-neon-purple/20 text-neon-purple px-2 py-0.5 rounded font-rajdhani">
                Weekly
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-rajdhani mt-1">
              {quest.description}
            </p>
            <p className="text-xs text-muted-foreground font-rajdhani mt-1">
              {quest.daysRemaining} days remaining
            </p>
          </div>
        </div>
        {quest.completed && (
          <div className="text-neon-green">
            <Trophy className="w-6 h-6" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground font-rajdhani">
            {quest.progress} / {quest.target}
          </span>
          <span className="font-orbitron text-lg text-neon-orange">
            +{quest.reward} pts
          </span>
        </div>
        <Progress
          value={(quest.progress / quest.target) * 100}
          className="h-3"
        />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border-2 border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-border bg-gradient-to-r from-neon-purple/10 to-neon-pink/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-neon-purple" />
              <div>
                <h2 className="font-orbitron text-xl sm:text-2xl text-foreground">
                  Daily Challenges
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground font-rajdhani">
                  Complete challenges to earn rewards!
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-neon-orange" />
              <span className="text-sm font-rajdhani">
                <span className="font-orbitron text-neon-orange">{streak}</span> day streak
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-neon-cyan" />
              <span className="text-sm font-rajdhani">
                <span className="font-orbitron text-neon-cyan">{totalRewards}</span> total rewards
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-neon-green" />
              <span className="text-sm font-rajdhani">
                <span className="font-orbitron text-neon-green">{completedCount}/{challenges.length}</span> completed
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Weekly Quest */}
          {weeklyQuest && (
            <div>
              <h3 className="font-orbitron text-sm text-neon-purple uppercase tracking-wider mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                Weekly Quest
              </h3>
              <QuestCard quest={weeklyQuest} />
            </div>
          )}

          {/* Daily Challenges */}
          <div>
            <h3 className="font-orbitron text-sm text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Today's Challenges
            </h3>
            <div className="space-y-3">
              {challenges.map(challenge => (
                <ChallengeCard key={challenge.id} challenge={challenge} />
              ))}
            </div>
          </div>

          {/* Rewards Info */}
          <div className="bg-muted/30 rounded-xl p-4 border border-border">
            <p className="text-xs text-muted-foreground font-rajdhani text-center">
              Complete challenges to earn reward points. Use points to unlock power-ups and special features!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyChallenges;
