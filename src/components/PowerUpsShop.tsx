import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, ShoppingBag, Coins, Sparkles } from 'lucide-react';
import { usePowerUps } from '@/hooks/usePowerUps';
import { haptics } from '@/utils/haptics';
import { soundManager } from '@/utils/soundManager';
import { toast } from '@/hooks/use-toast';

interface PowerUpsShopProps {
  isOpen: boolean;
  onClose: () => void;
}

const PowerUpsShop: React.FC<PowerUpsShopProps> = ({ isOpen, onClose }) => {
  const {
    currency,
    ownedPowerUps,
    buyPowerUp,
    getAllPowerUps,
    getOwnedQuantity,
  } = usePowerUps();
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const powerUps = getAllPowerUps();

  const handleBuy = async (powerUpId: string) => {
    setPurchasing(powerUpId);
    const success = buyPowerUp(powerUpId);
    
    if (success) {
      haptics.success();
      soundManager.playLocalSound('correct');
      toast({
        title: 'Purchase Successful!',
        description: 'Power-up added to your inventory',
      });
    } else {
      haptics.error();
      soundManager.playLocalSound('wrong');
      toast({
        variant: 'destructive',
        title: 'Purchase Failed',
        description: 'Not enough coins! Complete challenges to earn more.',
      });
    }
    
    setTimeout(() => setPurchasing(null), 500);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-neon-orange" />
            Power-Ups Shop
          </DialogTitle>
          <DialogDescription>
            Buy power-ups to enhance your gameplay
          </DialogDescription>
        </DialogHeader>

        {/* Currency Display */}
        <div className="bg-neon-yellow/10 border border-neon-yellow/50 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-neon-yellow" />
              <span className="font-orbitron text-lg text-foreground">Your Coins</span>
            </div>
            <span className="font-orbitron text-2xl text-neon-yellow">{currency.toLocaleString()}</span>
          </div>
          <p className="text-xs text-muted-foreground font-rajdhani mt-2">
            Complete daily challenges and win games to earn more coins!
          </p>
        </div>

        {/* Power-Ups Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {powerUps.map(powerUp => {
              const owned = getOwnedQuantity(powerUp.id);
              const canAfford = currency >= powerUp.cost;
              const isPurchasing = purchasing === powerUp.id;

              return (
                <div
                  key={powerUp.id}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    canAfford
                      ? 'bg-card/50 border-border hover:border-neon-cyan/50'
                      : 'bg-muted/30 border-border/50 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">{powerUp.icon}</div>
                      <div>
                        <h3 className="font-orbitron text-base text-foreground">
                          {powerUp.name}
                        </h3>
                        <p className="text-xs text-muted-foreground font-rajdhani mt-1">
                          {powerUp.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-neon-yellow" />
                      <span className="font-orbitron text-sm text-foreground">
                        {powerUp.cost}
                      </span>
                      {owned > 0 && (
                        <Badge variant="outline" className="bg-neon-green/20 text-neon-green border-neon-green/50">
                          Owned: {owned}
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      disabled={!canAfford || isPurchasing}
                      onClick={() => handleBuy(powerUp.id)}
                      className={`${
                        canAfford
                          ? 'bg-neon-green/20 border border-neon-green text-neon-green hover:bg-neon-green/30'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isPurchasing ? 'Buying...' : 'Buy'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Info */}
        <div className="bg-muted/30 rounded-xl p-3 border border-border mt-4">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-neon-purple mt-0.5" />
            <p className="text-xs text-muted-foreground font-rajdhani">
              Power-ups can only be used in single-player games. Use them strategically to improve your scores!
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PowerUpsShop;
