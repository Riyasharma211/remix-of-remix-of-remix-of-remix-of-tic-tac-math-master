import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { X, User, Edit2, Trophy, Star, Award, TrendingUp } from 'lucide-react';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useGameStats } from '@/hooks/useGameStats';
import { haptics } from '@/utils/haptics';
import { soundManager } from '@/utils/soundManager';

interface UserProfileProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVATARS = [
  '😀', '😎', '🤖', '🦄', '🐉', '🦁', '🐺', '🦊',
  '🐼', '🐨', '🦉', '🐸', '🦋', '🐝', '🦄', '👾',
  '🤖', '👽', '🎮', '🎯', '🏆', '⭐', '🔥', '💎',
];

const UserProfile: React.FC<UserProfileProps> = ({ isOpen, onClose }) => {
  const { profile, updateProfile, getXPProgress, getXPForNextLevel } = useUserProfile();
  const { getOverallStats } = useGameStats();
  const overallStats = getOverallStats();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(profile.displayName || profile.username);
  const [selectedAvatar, setSelectedAvatar] = useState(profile.avatar);
  
  // Sync profile with game stats
  React.useEffect(() => {
    if (overallStats.totalGames !== profile.totalGames || overallStats.totalWins !== profile.totalWins) {
      updateProfile({
        totalGames: overallStats.totalGames,
        totalWins: overallStats.totalWins,
      });
    }
  }, [overallStats.totalGames, overallStats.totalWins, profile.totalGames, profile.totalWins, updateProfile]);

  if (!isOpen) return null;

  const handleSave = () => {
    updateProfile({
      displayName: editName.trim() || profile.username,
      avatar: selectedAvatar,
    });
    setIsEditing(false);
    haptics.success();
    soundManager.playLocalSound('correct');
  };

  const xpProgress = getXPProgress();
  const xpForNextLevel = getXPForNextLevel();
  const currentLevelXP = (profile.level - 1) * 100;
  const xpInCurrentLevel = profile.xp - currentLevelXP;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-neon-cyan" />
            Your Profile
          </DialogTitle>
          <DialogDescription>
            View and customize your gaming profile
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Profile Header */}
          <div className="flex items-center gap-4 p-4 bg-card/50 rounded-xl border border-border">
            <div className="text-6xl">{profile.avatar}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-orbitron text-xl text-foreground">
                  {profile.displayName || profile.username}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setIsEditing(true);
                    haptics.light();
                  }}
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground font-rajdhani">
                Level {profile.level} • {profile.xp} XP
              </p>
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-rajdhani">
                    {xpInCurrentLevel} / {xpForNextLevel} XP to Level {profile.level + 1}
                  </span>
                  <span className="font-orbitron text-neon-cyan">
                    {Math.round(xpProgress)}%
                  </span>
                </div>
                <Progress value={xpProgress} className="h-2" />
              </div>
            </div>
          </div>

          {/* Edit Mode */}
          {isEditing && (
            <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Display Name
                </label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter your display name"
                  className="font-rajdhani"
                  maxLength={20}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Choose Avatar
                </label>
                <div className="grid grid-cols-8 gap-2">
                  {AVATARS.map(avatar => (
                    <button
                      key={avatar}
                      onClick={() => {
                        setSelectedAvatar(avatar);
                        haptics.light();
                      }}
                      className={`text-3xl p-2 rounded-lg border-2 transition-all hover:scale-110 ${
                        selectedAvatar === avatar
                          ? 'border-neon-cyan bg-neon-cyan/20 scale-110'
                          : 'border-border hover:border-neon-cyan/50'
                      }`}
                    >
                      {avatar}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  className="flex-1 bg-neon-cyan/20 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/30"
                >
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setEditName(profile.displayName || profile.username);
                    setSelectedAvatar(profile.avatar);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card/50 border border-border rounded-xl p-3 text-center">
              <Trophy className="w-6 h-6 text-neon-orange mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground font-orbitron">
                {overallStats.totalWins || profile.totalWins}
              </p>
              <p className="text-xs text-muted-foreground font-rajdhani">Wins</p>
            </div>
            <div className="bg-card/50 border border-border rounded-xl p-3 text-center">
              <Gamepad2 className="w-6 h-6 text-neon-cyan mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground font-orbitron">
                {overallStats.totalGames || profile.totalGames}
              </p>
              <p className="text-xs text-muted-foreground font-rajdhani">Games</p>
            </div>
            <div className="bg-card/50 border border-border rounded-xl p-3 text-center">
              <Star className="w-6 h-6 text-neon-yellow mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground font-orbitron">
                {profile.level}
              </p>
              <p className="text-xs text-muted-foreground font-rajdhani">Level</p>
            </div>
            <div className="bg-card/50 border border-border rounded-xl p-3 text-center">
              <Award className="w-6 h-6 text-neon-purple mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground font-orbitron">
                {profile.badges.length}
              </p>
              <p className="text-xs text-muted-foreground font-rajdhani">Badges</p>
            </div>
          </div>

          {/* Badges */}
          {profile.badges.length > 0 && (
            <div>
              <h3 className="font-orbitron text-sm text-foreground mb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-neon-purple" />
                Earned Badges
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.badges.map(badge => (
                  <div
                    key={badge}
                    className="px-3 py-1.5 bg-neon-purple/20 border border-neon-purple rounded-lg text-sm font-rajdhani"
                  >
                    {badge}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Win Rate */}
          {(overallStats.totalGames || profile.totalGames) > 0 && (
            <div className="bg-card/50 border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-neon-green" />
                <h3 className="font-orbitron text-sm text-foreground">Win Rate</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-rajdhani">Wins / Total</span>
                  <span className="font-orbitron text-neon-green">
                    {overallStats.overallWinRate.toFixed(1)}%
                  </span>
                </div>
                <Progress
                  value={overallStats.overallWinRate}
                  className="h-3"
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserProfile;
