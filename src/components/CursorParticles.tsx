import React, { useEffect, useRef, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  createdAt: number;
}

const COLORS = ['#00f5ff', '#bf00ff', '#ff6b9d', '#00ff88'];
const PARTICLE_LIFETIME = 1000;
const MAX_PARTICLES = 30;

const CursorParticles: React.FC = () => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const particleIdRef = useRef(0);
  const lastMousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Only create particles when moving fast enough
      if (distance > 15) {
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        
        const newParticle: Particle = {
          id: particleIdRef.current++,
          x: e.clientX + (Math.random() - 0.5) * 20,
          y: e.clientY + (Math.random() - 0.5) * 20,
          size: Math.random() * 6 + 3,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          opacity: 1,
          createdAt: Date.now(),
        };

        setParticles(prev => [...prev.slice(-MAX_PARTICLES + 1), newParticle]);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Cleanup old particles
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setParticles(prev => prev.filter(p => now - p.createdAt < PARTICLE_LIFETIME));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden hidden lg:block">
      {particles.map(particle => {
        const age = Date.now() - particle.createdAt;
        const progress = age / PARTICLE_LIFETIME;
        const opacity = 1 - progress;
        const scale = 1 - progress * 0.5;
        const translateY = progress * -30;

        return (
          <div
            key={particle.id}
            className="absolute rounded-full"
            style={{
              left: particle.x,
              top: particle.y,
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.color,
              opacity: opacity,
              transform: `translate(-50%, -50%) translateY(${translateY}px) scale(${scale})`,
              boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
              transition: 'opacity 0.1s ease-out',
            }}
          />
        );
      })}
    </div>
  );
};

export default CursorParticles;
