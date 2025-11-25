import React, { useState, useRef } from 'react';
import { FlowerTheme } from '../types';

interface ThemeWheelProps {
  themes: FlowerTheme[];
  onSelect: (index: number) => void;
  isOpen: boolean;
  onClose: () => void;
  labels: { title: string; spin: string };
}

const ThemeWheel: React.FC<ThemeWheelProps> = ({ themes, onSelect, isOpen, onClose, labels }) => {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const segmentAngle = 360 / themes.length;

  const spin = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    
    // Random spin: at least 3 full rotations (1080) + random segment
    const randomOffset = Math.floor(Math.random() * 360);
    const newRotation = rotation + 1080 + randomOffset;
    
    setRotation(newRotation);

    setTimeout(() => {
      setIsSpinning(false);
      // Calculate selected index
      // The wheel rotates clockwise. The pointer is usually at the top (0 degrees or 270 degrees depending on css).
      // Assuming pointer is at top (0 deg).
      const normalizedRotation = newRotation % 360;
      // Index calculation logic can be tricky depending on initial offset.
      // Let's rely on visual feedback and just pick random logic to keep it simple and robust
      const selectedIndex = Math.floor(((360 - (normalizedRotation % 360)) % 360) / segmentAngle);
      onSelect(selectedIndex);
    }, 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl relative flex flex-col items-center" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4 text-primary">{labels.title}</h2>
        
        <div className="relative w-64 h-64 mb-6">
            {/* Pointer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-4 z-10 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[20px] border-t-red-600 drop-shadow-md"></div>
            
            {/* Wheel */}
            <div 
                ref={wheelRef}
                className="w-full h-full rounded-full overflow-hidden relative shadow-xl border-4 border-white dark:border-gray-700 wheel-container"
                style={{ transform: `rotate(${rotation}deg)` }}
            >
                {themes.map((theme, index) => {
                     // Using Conic Gradient via CSS plain style for segments is easier than SVG paths for dynamic length
                     return (
                         <div 
                            key={index}
                            className="absolute w-full h-full top-0 left-0"
                            style={{
                                backgroundColor: theme.primary,
                                clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos(((index * segmentAngle) - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin(((index * segmentAngle) - 90) * Math.PI / 180)}%, ${50 + 50 * Math.cos((((index + 1) * segmentAngle) - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((((index + 1) * segmentAngle) - 90) * Math.PI / 180)}%)`
                            }}
                         />
                     )
                })}
            </div>
        </div>

        <button 
            onClick={spin} 
            disabled={isSpinning}
            className="px-8 py-2 bg-primary text-white text-lg font-bold rounded-full shadow-lg hover:scale-105 transition transform disabled:opacity-50 disabled:scale-100"
        >
            {isSpinning ? '...' : labels.spin}
        </button>
      </div>
    </div>
  );
};

export default ThemeWheel;