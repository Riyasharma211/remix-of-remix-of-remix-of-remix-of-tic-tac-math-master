import React, { useState } from 'react';
import { Trophy, Medal, Star, Trash2, X, Calendar, Gamepad2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLeaderboard, GAME_NAMES, GAME_TYPES } from '@/hooks/useLeaderboard';
import { haptics } from '@/utils/haptics';
import { shareScoreCard } from '@/utils/socialShare';

interface LeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ isOpen, onClose }) => {
  const { entries, stats, getTopScores, getAllTimeTop, clearAll } = useLeaderboard();
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  if (!isOpen) return null;

  const gameTypes = Object.values(GAME_TYPES);
  const displayEntries = selectedGame 
    ? getTopScores(selectedGame, 10)
    : getAllTimeTop(15);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="w-5 h-5 text-yellow-400" />;
      case 1: return <Medal className="w-5 h-5 text-gray-300" />;
      case 2: return <Medal className="w-5 h-5 text-amber-600" />;
      default: return <span className="w-5 h-5 flex items-center justify-center text-muted-foreground font-bold">{index + 1}</span>;
    }
  };

  const handleClear = () => {
    haptics.heavy();
    clearAll();
    setShowConfirmClear(false);
  };

  const totalGames = Object.values(stats).reduce((acc, s) => acc + s.gamesPlayed, 0);
  const totalScore = Object.values(stats).reduce((acc, s) => acc + s.totalScore, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-border bg-gradient-to-r from-neon-cyan/10 to-neon-purple/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-neon-orange" />
              <h2 className="font-orbitron text-xl sm:text-2xl text-foreground">Leaderboard</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Stats Summary */}
          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-2 text-sm">
              <Gamepad2 className="w-4 h-4 text-neon-cyan" />
              <span className="text-muted-foreground">{totalGames} games</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Star className="w-4 h-4 text-neon-orange" />
              <span className="text-muted-foreground">{totalScore.toLocaleString()} pts</span>
            </div>
          </div>
        </div>

        {/* Game Filter */}
        <div className="p-3 sm:p-4 border-b border-border overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 min-w-max">
            <button
              onClick={() => {
                setSelectedGame(null);
                haptics.light();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-orbitron whitespace-nowrap transition-all
                ${!selectedGame 
                  ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan' 
                  : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted'
                }`}
            >
              All Games
            </button>
            {gameTypes.map((type) => {
              const hasEntries = entries.some(e => e.gameType === type);
              if (!hasEntries) return null;
              return (
                <button
                  key={type}
                  onClick={() => {
                    setSelectedGame(type);
                    haptics.light();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-orbitron whitespace-nowrap transition-all
                    ${selectedGame === type 
                      ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple' 
                      : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted'
                    }`}
                >
                  {GAME_NAMES[type]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Leaderboard List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {displayEntries.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-rajdhani">No scores yet!</p>
              <p className="text-muted-foreground/60 font-rajdhani text-sm">Play some games to see your scores here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayEntries.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                    ${index === 0 ? 'bg-yellow-500/10 border-yellow-500/30' : 
                      index === 1 ? 'bg-gray-400/10 border-gray-400/30' :
                      index === 2 ? 'bg-amber-600/10 border-amber-600/30' :
                      'bg-card/50 border-border'
                    }`}
                >
                  <div className="flex-shrink-0">
                    {getRankIcon(index)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-orbitron text-sm text-foreground truncate">
                        {entry.playerName}
                      </span>
                      {!selectedGame && (
                        <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                          {GAME_NAMES[entry.gameType]}
                        </span>
                      )}
                    </div>
                    {entry.details && (
                      <p className="text-xs text-muted-foreground truncate">{entry.details}</p>
                    )}
                  </div>
                  
                  <div className="flex-shrink-0 text-right flex items-center gap-2">
                    <div>
                      <div className="font-orbitron text-lg text-neon-cyan">{entry.score.toLocaleString()}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {formatDate(entry.date)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={async () => {
                        await shareScoreCard(
                          GAME_NAMES[entry.gameType] || entry.gameType,
                          entry.score,
                          { wins: 1 }
                        );
                        haptics.light();
                      }}
                    >
                      <Share2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {entries.length > 0 && (
          <div className="p-3 sm:p-4 border-t border-border">
            {showConfirmClear ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-destructive font-rajdhani">Clear all scores?</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowConfirmClear(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleClear}>
                    Clear All
                  </Button>
                </div>
              </div>
            ) : (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setShowConfirmClear(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Scores
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
