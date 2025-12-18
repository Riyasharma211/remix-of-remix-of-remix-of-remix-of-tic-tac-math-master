// Haptic feedback utility for mobile devices
export const haptics = {
  // Light tap feedback
  light: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  },
  
  // Medium feedback for selections
  medium: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(25);
    }
  },
  
  // Heavy feedback for important actions
  heavy: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  },
  
  // Success pattern
  success: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([30, 50, 30]);
    }
  },
  
  // Error pattern
  error: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 30, 50, 30, 50]);
    }
  },
  
  // Custom pattern
  pattern: (pattern: number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  },

  // Screen shake effect for dramatic loss
  screenShake: () => {
    const gameContainer = document.querySelector('[data-game-container]') || document.body;
    gameContainer.classList.add('animate-screen-shake');
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 100]);
    }
    setTimeout(() => {
      gameContainer.classList.remove('animate-screen-shake');
    }, 500);
  }
};
