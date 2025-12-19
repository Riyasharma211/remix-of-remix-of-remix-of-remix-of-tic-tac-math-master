import { celebrateFireworks } from './confetti';
import { soundManager } from './soundManager';
import { haptics } from './haptics';

interface ShareData {
  title: string;
  text: string;
  url?: string;
}

export const shareToSocial = async (data: ShareData) => {
  const shareText = `${data.title}\n\n${data.text}\n\nPlay at: ${data.url || window.location.href}`;

  // Check if Web Share API is available (mobile)
  if (navigator.share) {
    try {
      await navigator.share({
        title: data.title,
        text: data.text,
        url: data.url || window.location.href,
      });
      soundManager.playLocalSound('correct');
      haptics.success();
      return true;
    } catch (error) {
      // User cancelled or error occurred
      if ((error as Error).name !== 'AbortError') {
        console.error('Error sharing:', error);
      }
      return false;
    }
  } else {
    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      soundManager.playLocalSound('correct');
      haptics.success();
      return true;
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      return false;
    }
  }
};

export const shareAchievement = async (achievementName: string, description: string) => {
  return shareToSocial({
    title: `🏆 Achievement Unlocked: ${achievementName}!`,
    text: `I just unlocked "${achievementName}" in Mind Games! ${description}`,
  });
};

export const shareScore = async (gameName: string, score: number, details?: string) => {
  return shareToSocial({
    title: `🎮 New High Score in ${gameName}!`,
    text: `I scored ${score} points in ${gameName}!${details ? ` ${details}` : ''} Challenge me!`,
  });
};

export const shareTournamentWin = async (tournamentName: string, rank: number) => {
  const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏆';
  return shareToSocial({
    title: `${rankEmoji} Tournament Winner!`,
    text: `I ranked #${rank} in the ${tournamentName} tournament! Can you beat me?`,
  });
};

export const shareGameReplay = async (gameName: string, roomCode: string) => {
  return shareToSocial({
    title: `🎮 Watch my ${gameName} game!`,
    text: `Check out my amazing game! Room code: ${roomCode}`,
    url: `${window.location.href}?replay=${roomCode}`,
  });
};

export const generateScoreCard = (gameName: string, score: number, stats: {
  wins?: number;
  losses?: number;
  accuracy?: number;
  time?: number;
}) => {
  // Generate a text-based score card
  let card = `╔════════════════════════╗\n`;
  card += `║   🎮 MIND GAMES 🎮    ║\n`;
  card += `╠════════════════════════╣\n`;
  card += `║ ${gameName.padEnd(22)} ║\n`;
  card += `╠════════════════════════╣\n`;
  card += `║ Score: ${score.toString().padStart(15)} ║\n`;
  
  if (stats.wins !== undefined) {
    card += `║ Wins: ${stats.wins.toString().padStart(16)} ║\n`;
  }
  if (stats.accuracy !== undefined) {
    card += `║ Accuracy: ${stats.accuracy.toString().padStart(12)}% ║\n`;
  }
  if (stats.time !== undefined) {
    card += `║ Time: ${stats.time.toString().padStart(16)}s ║\n`;
  }
  
  card += `╚════════════════════════╝\n`;
  card += `Play at: ${window.location.href}`;
  
  return card;
};

export const shareScoreCard = async (gameName: string, score: number, stats: {
  wins?: number;
  losses?: number;
  accuracy?: number;
  time?: number;
}) => {
  const card = generateScoreCard(gameName, score, stats);
  return shareToSocial({
    title: `🎮 ${gameName} - Score: ${score}`,
    text: card,
  });
};
