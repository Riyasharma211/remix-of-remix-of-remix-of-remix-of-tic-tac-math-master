import React, { useState } from 'react';
import { X, Trophy, Clock, Target, Flame, Gamepad2, Award, TrendingUp, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGameStats, Achievement } from '@/hooks/useGameStats';
import { GAME_NAMES } from '@/hooks/useLeaderboard';
import { haptics } from '@/utils/haptics';

interface GameStatsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

const GameStatsDashboard: React.FC<GameStatsDashboardProps> = ({ isOpen, onClose }) => {
  const { stats, achievements, getOverallStats, formatPlayTime, getWinRate } = useGameStats();
  const [activeTab, setActiveTab] = useState('overview');

  if (!isOpen) return null;

  const overall = getOverallStats();
  const unlockedAchievements = achievements.filter(a => a.unlockedAt);
  const lockedAchievements = achievements.filter(a => !a.unlockedAt);

  const handleClose = () => {
    haptics.light();
    onClose();
  };

  const StatCard = ({ icon: Icon, label, value, subValue, color }: { 
    icon: React.ElementType; 
    label: string; 
    value: string | number; 
    subValue?: string;
    color: string;
  }) => (
    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-4 flex flex-col items-center text-center">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-2xl font-bold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
      {subValue && <span className="text-xs text-muted-foreground/70 mt-1">{subValue}</span>}
    </div>
  );

  const AchievementCard = ({ achievement, locked = false }: { achievement: Achievement; locked?: boolean }) => (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
      locked 
        ? 'bg-muted/20 border-border/30 opacity-60' 
        : 'bg-gradient-to-r from-neon-yellow/10 to-neon-orange/10 border-neon-yellow/30'
    }`}>
      <span className="text-2xl">{achievement.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`font-medium text-sm ${locked ? 'text-muted-foreground' : 'text-foreground'}`}>
          {achievement.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">{achievement.description}</p>
        {locked && achievement.maxProgress && achievement.progress !== undefined && (
          <div className="mt-1">
            <Progress 
              value={(achievement.progress / achievement.maxProgress) * 100} 
              className="h-1"
            />
            <span className="text-[10px] text-muted-foreground">
              {achievement.progress} / {achievement.maxProgress}
            </span>
          </div>
        )}
      </div>
      {!locked && (
        <div className="text-neon-green">
          <Award className="w-5 h-5" />
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-neon-purple/10 to-neon-blue/10">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-neon-purple" />
            <h2 className="text-xl font-bold text-foreground">Game Statistics</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-4 grid grid-cols-3 bg-muted/50">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="games" className="text-xs sm:text-sm">By Game</TabsTrigger>
            <TabsTrigger value="achievements" className="text-xs sm:text-sm">Achievements</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard 
                  icon={Gamepad2} 
                  label="Games Played" 
                  value={overall.totalGames}
                  color="bg-neon-blue/20 text-neon-blue"
                />
                <StatCard 
                  icon={Trophy} 
                  label="Win Rate" 
                  value={`${overall.overallWinRate.toFixed(1)}%`}
                  subValue={`${overall.totalWins}W / ${overall.totalLosses}L`}
                  color="bg-neon-green/20 text-neon-green"
                />
                <StatCard 
                  icon={Clock} 
                  label="Play Time" 
                  value={formatPlayTime(overall.totalPlayTime)}
                  color="bg-neon-purple/20 text-neon-purple"
                />
                <StatCard 
                  icon={Flame} 
                  label="Best Streak" 
                  value={overall.bestStreak}
                  color="bg-neon-orange/20 text-neon-orange"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatCard 
                  icon={Target} 
                  label="Total Score" 
                  value={overall.totalScore.toLocaleString()}
                  color="bg-neon-yellow/20 text-neon-yellow"
                />
                <StatCard 
                  icon={Award} 
                  label="Achievements" 
                  value={`${unlockedAchievements.length}/${achievements.length}`}
                  color="bg-neon-pink/20 text-neon-pink"
                />
              </div>

              {/* Recent Achievements */}
              {unlockedAchievements.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Award className="w-4 h-4 text-neon-yellow" />
                    Recent Achievements
                  </h3>
                  <div className="space-y-2">
                    {unlockedAchievements.slice(0, 3).map(achievement => (
                      <AchievementCard key={achievement.id} achievement={achievement} />
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Games Tab */}
            <TabsContent value="games" className="mt-0 space-y-3">
              {Object.keys(stats).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Gamepad2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No games played yet</p>
                  <p className="text-sm">Start playing to see your stats!</p>
                </div>
              ) : (
                Object.entries(stats).map(([gameType, gameStats]) => (
                  <div key={gameType} className="bg-card/50 border border-border/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-foreground">
                        {GAME_NAMES[gameType] || gameType}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {gameStats.gamesPlayed} games
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div>
                        <p className="text-lg font-bold text-neon-green">{gameStats.wins}</p>
                        <p className="text-muted-foreground">Wins</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-neon-pink">{gameStats.losses}</p>
                        <p className="text-muted-foreground">Losses</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-neon-purple">{getWinRate(gameType).toFixed(0)}%</p>
                        <p className="text-muted-foreground">Win Rate</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-neon-orange">{gameStats.highScore}</p>
                        <p className="text-muted-foreground">Best</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatPlayTime(gameStats.totalPlayTime)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Flame className="w-3 h-3" />
                        Best streak: {gameStats.streaks.best}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* Achievements Tab */}
            <TabsContent value="achievements" className="mt-0 space-y-4">
              {/* Progress */}
              <div className="bg-card/50 border border-border/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Achievement Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {unlockedAchievements.length} / {achievements.length}
                  </span>
                </div>
                <Progress 
                  value={(unlockedAchievements.length / achievements.length) * 100} 
                  className="h-2"
                />
              </div>

              {/* Unlocked */}
              {unlockedAchievements.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-neon-yellow" />
                    Unlocked ({unlockedAchievements.length})
                  </h3>
                  <div className="space-y-2">
                    {unlockedAchievements.map(achievement => (
                      <AchievementCard key={achievement.id} achievement={achievement} />
                    ))}
                  </div>
                </div>
              )}

              {/* Locked */}
              {lockedAchievements.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    In Progress ({lockedAchievements.length})
                  </h3>
                  <div className="space-y-2">
                    {lockedAchievements.map(achievement => (
                      <AchievementCard key={achievement.id} achievement={achievement} locked />
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default GameStatsDashboard;
