import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import gsap from 'gsap';

interface AnimatedNumberProps {
  value: number;
  precision?: number;
  className?: string;
  format?: (val: number) => string;
}

const Digit = ({ char, height }: { char: string; height: number }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isNumber = !isNaN(parseInt(char));

  useEffect(() => {
    if (!containerRef.current || !isNumber) return;

    const targetIndex = parseInt(char);
    gsap.to(containerRef.current, {
      y: -targetIndex * height,
      duration: 0.8,
      ease: "back.out(1.7)", // Physics-based springy feel
    });
  }, [char, height, isNumber]);

  if (!isNumber) {
    return (
      <div 
        style={{ height, lineHeight: `${height}px` }} 
        className="flex items-center justify-center"
      >
        {char}
      </div>
    );
  }

  return (
    <div className="overflow-hidden relative" style={{ height, width: '0.6em' }}>
      <div ref={containerRef} className="flex flex-col items-center absolute w-full top-0 left-0">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <div 
            key={n} 
            style={{ height, lineHeight: `${height}px` }} 
            className="flex items-center justify-center w-full"
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
};

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  precision = 0,
  className,
  format
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [digitHeight, setDigitHeight] = useState(0);
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (measureRef.current) {
      setDigitHeight(measureRef.current.clientHeight);
    }
  }, []);

  // Format the value
  const formatted = format ? format(value) : value.toFixed(precision);
  const chars = formatted.split('');

  return (
    <div 
      ref={containerRef} 
      className={cn("flex flex-row items-center font-mono relative", className)}
    >
      {/* Invisible measurement element */}
      <div 
        ref={measureRef} 
        className="absolute opacity-0 pointer-events-none"
        aria-hidden="true"
      >
        0
      </div>

      {digitHeight > 0 && chars.map((char, index) => (
        // Use index as key to maintain component identity for animation
        <Digit key={index} char={char} height={digitHeight} />
      ))}
      
      {/* Fallback while measuring */}
      {digitHeight === 0 && <span>{formatted}</span>}
    </div>
  );
};

// Simpler version for just tweening the number text if the rolling effect is too heavy or breaks layout
export const TweenNumber: React.FC<AnimatedNumberProps> = ({
  value,
  precision = 0,
  className,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    if (!ref.current) return;

    gsap.to(prevValue, {
      current: value,
      duration: 1,
      ease: "power3.out",
      onUpdate: () => {
        if (ref.current) {
          ref.current.innerText = prevValue.current.toFixed(precision);
        }
      },
    });
  }, [value, precision]);

  return <span ref={ref} className={className}>{value.toFixed(precision)}</span>;
};
