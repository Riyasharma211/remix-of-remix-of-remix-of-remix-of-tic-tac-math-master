import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { haptics } from '@/utils/haptics';

interface LeaveGameDialogProps {
  isOpen: boolean;
  gameName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const LeaveGameDialog: React.FC<LeaveGameDialogProps> = ({ isOpen, gameName, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    haptics.medium();
    onConfirm();
  };

  const handleCancel = () => {
    haptics.light();
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={handleCancel}
      />
      
      {/* iOS-style Dialog */}
      <div className="relative w-full max-w-[280px] bg-gradient-to-b from-zinc-800/95 to-zinc-900/95 backdrop-blur-xl rounded-[20px] shadow-2xl shadow-black/50 animate-scale-in overflow-hidden">
        {/* Warning Icon */}
        <div className="flex flex-col items-center pt-6 pb-4 px-4">
          <div className="w-14 h-14 rounded-full bg-orange-500/20 flex items-center justify-center mb-3">
            <AlertTriangle className="w-7 h-7 text-orange-400" />
          </div>
          
          {/* Title */}
          <h3 className="text-[17px] font-semibold text-white text-center">
            Leave Game?
          </h3>
          
          {/* Message */}
          <p className="text-[13px] text-zinc-400 text-center mt-2 leading-relaxed">
            You're currently playing <span className="text-white font-medium">{gameName}</span>. If you leave now, your progress will be lost.
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/10" />

        {/* Buttons - iOS style stacked */}
        <div className="flex flex-col">
          <button
            onClick={handleConfirm}
            className="py-3.5 text-[17px] font-medium text-red-400 hover:bg-white/5 active:bg-white/10 transition-colors"
          >
            Leave Game
          </button>
          
          <div className="h-px bg-white/10" />
          
          <button
            onClick={handleCancel}
            className="py-3.5 text-[17px] font-semibold text-blue-400 hover:bg-white/5 active:bg-white/10 transition-colors"
          >
            Continue Playing
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaveGameDialog;
