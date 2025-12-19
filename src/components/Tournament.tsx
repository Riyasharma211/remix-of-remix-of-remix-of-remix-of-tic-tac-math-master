import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trophy, Medal, Star, X, Calendar, Users, Award, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTournament } from '@/hooks/useTournament';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { haptics } from '@/utils/haptics';
import { soundManager } from '@/utils/soundManager';
import { toast } from '@/hooks/use-toast';

interface TournamentProps {
  isOpen: boolean;
  onClose: () => void;
}

const TIER_COLORS = {
  bronze: 'text-amber-600',
  silver: 'text-gray-300',
  gold: 'text-yellow-400',
  platinum: 'text-purple-400',
};

const TIER_BG_COLORS = {
  bronze: 'bg-amber-600/20 border-amber-600/50',
  silver: 'bg-gray-300/20 border-gray-300/50',
  gold: 'bg-yellow-400/20 border-yellow-400/50',
  platinum: 'bg-purple-400/20 border-purple-400/50',
};

const Tournament: React.FC<TournamentProps> = ({ isOpen, onClose }) => {
  const {
    currentTournament,
    myEntry,
    leaderboard,
    joinTournament,
    getMyRank,
    getTopPlayers,
  } = useTournament();
  const { profile } = useUserProfile();
  const [isJoining, setIsJoining] = useState(false);

  if (!isOpen || !currentTournament) return null;

  const myRank = getMyRank();
  const topPlayers = getTopPlayers(10);
  const daysRemaining = Math.ceil((currentTournament.endDate - Date.now()) / (1000 * 60 * 60 * 24));
  const progress = ((Date.now() - currentTournament.startDate) / (currentTournament.endDate - currentTournament.startDate)) * 100;

  const handleJoin = () => {
    setIsJoining(true);
    joinTournament(profile.displayName || profile.username);
    haptics.success();
    soundManager.playLocalSound('correct');
    toast({
      title: 'Joined Tournament!',
      description: 'Start playing to climb the leaderboard!',
    });
    setTimeout(() => setIsJoining(false), 500);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="w-5 h-5 text-yellow-400" />;
      case 2: return <Medal className="w-5 h-5 text-gray-300" />;
      case 3: return <Medal className="w-5 h-5 text-amber-600" />;
      default: return <span className="w-5 h-5 flex items-center justify-center text-muted-foreground font-bold text-sm">{rank}</span>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-neon-orange" />
            Weekly Tournament
          </DialogTitle>
          <DialogDescription>
            Compete for the top spot and win rewards!
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Tournament Info */}
          <div className={`p-4 rounded-xl border-2 ${TIER_BG_COLORS[currentTournament.tier]}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-orbitron text-lg text-foreground">
                    {currentTournament.name}
                  </h3>
                  <Badge
                    variant="outline"
                    className={`${TIER_COLORS[currentTournament.tier]} border-current`}
                  >
                    {currentTournament.tier.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground font-rajdhani">
                  {currentTournament.prize} • {currentTournament.participants} participants
                </p>
              </div>
              {!myEntry && currentTournament.status === 'active' && (
                <Button
                  onClick={handleJoin}
                  disabled={isJoining}
                  className="bg-neon-green/20 border border-neon-green text-neon-green hover:bg-neon-green/30"
                >
                  {isJoining ? 'Joining...' : 'Join Tournament'}
                </Button>
              )}
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-rajdhani">
                  {daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Tournament ended'}
                </span>
                <span className="font-orbitron text-neon-cyan">
                  {Math.round(progress)}%
                </span>
              </div>
              <Progress value={Math.min(progress, 100)} className="h-2" />
            </div>
          </div>

          {/* My Entry */}
          {myEntry && (
            <div className="bg-card/50 border border-neon-cyan rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-orbitron text-sm text-foreground">Your Progress</h3>
                {myRank && (
                  <Badge variant="outline" className="bg-neon-cyan/20 border-neon-cyan text-neon-cyan">
                    Rank #{myRank}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-2xl font-bold text-neon-cyan font-orbitron">{myEntry.score}</p>
                  <p className="text-xs text-muted-foreground font-rajdhani">Score</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-neon-green font-orbitron">{myEntry.wins}</p>
                  <p className="text-xs text-muted-foreground font-rajdhani">Wins</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-neon-purple font-orbitron">{myEntry.gamesPlayed}</p>
                  <p className="text-xs text-muted-foreground font-rajdhani">Games</p>
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard */}
          <div>
            <h3 className="font-orbitron text-sm text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-neon-orange" />
              Leaderboard
            </h3>
            {topPlayers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="font-rajdhani">No participants yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {topPlayers.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`p-3 rounded-xl border transition-all ${
                      entry.id === myEntry?.id
                        ? 'bg-neon-cyan/20 border-neon-cyan'
                        : index === 0
                        ? 'bg-yellow-500/10 border-yellow-500/30'
                        : index === 1
                        ? 'bg-gray-400/10 border-gray-400/30'
                        : index === 2
                        ? 'bg-amber-600/10 border-amber-600/30'
                        : 'bg-card/50 border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        {getRankIcon(entry.rank)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-rajdhani text-sm font-semibold text-foreground truncate">
                          {entry.playerName}
                          {entry.id === myEntry?.id && (
                            <span className="ml-2 text-xs text-neon-cyan">(You)</span>
                          )}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground font-rajdhani">
                          <span>{entry.wins} wins</span>
                          <span>•</span>
                          <span>{entry.gamesPlayed} games</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-orbitron text-lg text-neon-cyan">{entry.score.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground font-rajdhani">points</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Tournament;
