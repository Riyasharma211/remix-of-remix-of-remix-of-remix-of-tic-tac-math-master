import React, { useEffect, useState } from 'react';

const ParallaxOrbs: React.FC = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Normalize to -1 to 1 range
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      setMousePos({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const orbConfigs = [
    { 
      className: 'absolute top-10 left-10 w-32 sm:w-64 h-32 sm:h-64 bg-neon-cyan/20 rounded-full blur-[80px]',
      parallaxStrength: 20,
      animationClass: 'animate-orb-1'
    },
    { 
      className: 'absolute top-1/3 right-10 w-40 sm:w-80 h-40 sm:h-80 bg-neon-purple/25 rounded-full blur-[100px]',
      parallaxStrength: 30,
      animationClass: 'animate-orb-2'
    },
    { 
      className: 'absolute bottom-20 left-1/3 w-36 sm:w-72 h-36 sm:h-72 bg-neon-pink/20 rounded-full blur-[90px]',
      parallaxStrength: 25,
      animationClass: 'animate-orb-3'
    },
    { 
      className: 'absolute bottom-1/4 right-1/4 w-24 sm:w-48 h-24 sm:h-48 bg-neon-green/15 rounded-full blur-[70px]',
      parallaxStrength: 15,
      animationClass: 'animate-orb-1',
      delay: '-5s'
    },
  ];

  return (
    <>
      {orbConfigs.map((orb, index) => (
        <div
          key={index}
          className={`${orb.className} ${orb.animationClass} pointer-events-none transition-transform duration-300 ease-out`}
          style={{
            transform: `translate(${mousePos.x * orb.parallaxStrength}px, ${mousePos.y * orb.parallaxStrength}px)`,
            animationDelay: orb.delay || '0s',
          }}
        />
      ))}
    </>
  );
};

export default ParallaxOrbs;
