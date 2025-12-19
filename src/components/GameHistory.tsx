import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, X, Trophy, Clock, Calendar, Trash2, Share2 } from 'lucide-react';
import { useGameHistory } from '@/hooks/useGameHistory';
import { GAME_NAMES } from '@/hooks/useLeaderboard';
import { haptics } from '@/utils/haptics';
import { soundManager } from '@/utils/soundManager';
import { shareGameReplay } from '@/utils/socialShare';
import { toast } from '@/hooks/use-toast';

interface GameHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

const GameHistory: React.FC<GameHistoryProps> = ({ isOpen, onClose }) => {
  const { history, getGameHistory, getBestGame, getStats, clearHistory } = useGameHistory();
  const [selectedGameType, setSelectedGameType] = useState<string | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const displayHistory = selectedGameType
    ? getGameHistory(selectedGameType)
    : history;

  const stats = getStats();
  const bestGame = selectedGameType ? getBestGame(selectedGameType) : null;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case 'win': return 'bg-neon-green/20 text-neon-green border-neon-green/50';
      case 'loss': return 'bg-destructive/20 text-destructive border-destructive/50';
      case 'draw': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-muted/50 text-muted-foreground border-border';
    }
  };

  const handleClear = () => {
    clearHistory();
    setShowConfirmClear(false);
    haptics.heavy();
    soundManager.playLocalSound('click');
    toast({
      title: 'History Cleared',
      description: 'All game history has been cleared',
    });
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-neon-purple" />
            Game History
          </DialogTitle>
          <DialogDescription>
            View your past games and replays
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Stats Summary */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="bg-card/50 border border-border rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-neon-cyan font-orbitron">{stats.totalGames}</p>
              <p className="text-xs text-muted-foreground font-rajdhani">Games</p>
            </div>
            <div className="bg-card/50 border border-border rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-neon-green font-orbitron">{stats.wins}</p>
              <p className="text-xs text-muted-foreground font-rajdhani">Wins</p>
            </div>
            <div className="bg-card/50 border border-border rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-neon-orange font-orbitron">{stats.winRate.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground font-rajdhani">Win Rate</p>
            </div>
            <div className="bg-card/50 border border-border rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-neon-purple font-orbitron">{stats.totalScore.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground font-rajdhani">Score</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide pb-2">
            <button
              onClick={() => {
                setSelectedGameType(null);
                haptics.light();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-orbitron whitespace-nowrap transition-all ${
                !selectedGameType
                  ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan'
                  : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted'
              }`}
            >
              All Games
            </button>
            {Array.from(new Set(history.map(h => h.gameType))).map(type => (
              <button
                key={type}
                onClick={() => {
                  setSelectedGameType(type);
                  haptics.light();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-orbitron whitespace-nowrap transition-all ${
                  selectedGameType === type
                    ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple'
                    : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted'
                }`}
              >
                {GAME_NAMES[type] || type}
              </button>
            ))}
          </div>

          {/* Best Game Highlight */}
          {bestGame && (
            <div className="bg-neon-green/10 border border-neon-green/50 rounded-xl p-3 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-neon-green" />
                <span className="text-sm font-orbitron text-neon-green">Best Game</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-rajdhani text-foreground">
                    {GAME_NAMES[bestGame.gameType] || bestGame.gameType} • Score: {bestGame.score.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground font-rajdhani">
                    {formatDate(bestGame.timestamp)}
                  </p>
                </div>
                {bestGame.roomCode && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={async () => {
                      await shareGameReplay(
                        GAME_NAMES[bestGame.gameType] || bestGame.gameType,
                        bestGame.roomCode || ''
                      );
                      haptics.light();
                    }}
                  >
                    <Share2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* History List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {displayHistory.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-rajdhani">No game history</p>
                <p className="text-sm text-muted-foreground/60 font-rajdhani mt-1">
                  Play games to see your history here!
                </p>
              </div>
            ) : (
              displayHistory.map(entry => (
                <div
                  key={entry.id}
                  className="p-3 bg-card/50 border border-border rounded-xl hover:border-neon-cyan/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-orbitron text-sm text-foreground">
                          {GAME_NAMES[entry.gameType] || entry.gameType}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${getResultColor(entry.result)}`}
                        >
                          {entry.result}
                        </Badge>
                        {entry.gameMode === 'multiplayer' && (
                          <Badge variant="outline" className="text-xs bg-neon-purple/20 text-neon-purple border-neon-purple/50">
                            Multiplayer
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground font-rajdhani">
                        <div className="flex items-center gap-1">
                          <Trophy className="w-3 h-3" />
                          <span>{entry.score.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{entry.duration}s</span>
                        </div>
                        {entry.opponentName && (
                          <span>vs {entry.opponentName}</span>
                        )}
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(entry.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                    {entry.roomCode && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={async () => {
                          await shareGameReplay(
                            GAME_NAMES[entry.gameType] || entry.gameType,
                            entry.roomCode || ''
                          );
                          haptics.light();
                        }}
                      >
                        <Share2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {history.length > 0 && (
            <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
              <p className="text-xs text-muted-foreground font-rajdhani">
                {displayHistory.length} game{displayHistory.length !== 1 ? 's' : ''} shown
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfirmClear(true)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear History
              </Button>
            </div>
          )}
        </div>

        {/* Confirm Clear Dialog */}
        {showConfirmClear && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-xl p-6 max-w-sm">
              <h3 className="font-orbitron text-lg mb-2">Clear History?</h3>
              <p className="text-sm text-muted-foreground font-rajdhani mb-4">
                This will permanently delete all your game history. This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleClear}
                  className="flex-1"
                >
                  Clear
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmClear(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GameHistory;
