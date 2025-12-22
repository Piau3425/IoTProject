import { useEffect, useRef, RefObject } from 'react';
import gsap from 'gsap';
import { EASES, ANIMATION_CONFIG } from '@/lib/animation';

interface PhysicsConfig {
  damping?: number;
  stiffness?: number;
  mass?: number;
}

/**
 * Simulates a physical spring interaction for hover/active states.
 * Gives elements a "weighty" feel when pressed or hovered.
 */
export const useSpring = (
  ref: RefObject<HTMLElement>,
  options: { 
    scale?: number; 
    active?: boolean;
    stiffness?: number; // 0-1, higher is stiffer
  } = { scale: 0.95, active: true, stiffness: 0.5 }
) => {
  useEffect(() => {
    if (!ref.current || !options.active) return;
    const element = ref.current;
    const scale = options.scale || 0.95;

    const handleMouseDown = () => {
      gsap.to(element, {
        scale: scale,
        duration: 0.1, // Fast compression
        ease: "power2.out"
      });
    };

    const handleMouseUp = () => {
      gsap.to(element, {
        scale: 1,
        duration: 0.6, // Slower release with bounce
        ease: "elastic.out(1, 0.5)"
      });
    };

    const handleMouseEnter = () => {
      gsap.to(element, {
        y: -2, // Slight lift
        boxShadow: "0 10px 30px -10px rgba(0,0,0,0.3)",
        duration: 0.4,
        ease: "power2.out"
      });
    };

    const handleMouseLeave = () => {
      gsap.to(element, {
        y: 0,
        scale: 1,
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        duration: 0.6,
        ease: "power2.out"
      });
    };

    element.addEventListener('mousedown', handleMouseDown);
    element.addEventListener('mouseup', handleMouseUp);
    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mousedown', handleMouseDown);
      element.removeEventListener('mouseup', handleMouseUp);
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [ref, options.active, options.scale]);
};

export const useMagnetic = (
  ref: RefObject<HTMLElement>,
  options: { active: boolean; strength?: number } = { active: true, strength: 1 }
) => {
  useEffect(() => {
    if (!ref.current || !options.active) return;

    const element = ref.current;
    const strength = options.strength || 1;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Calculate distance from center
      const distanceX = e.clientX - centerX;
      const distanceY = e.clientY - centerY;

      // Magnetic pull with physics ease
      gsap.to(element, {
        x: distanceX * 0.1 * strength,
        y: distanceY * 0.1 * strength,
        rotationX: (distanceY / rect.height) * -10 * strength, // Tilt X
        rotationY: (distanceX / rect.width) * 10 * strength,   // Tilt Y
        duration: 0.5,
        ease: "power2.out"
      });

      // Spotlight effect variables
      element.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
      element.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    };

    const handleMouseLeave = () => {
      gsap.to(element, {
        x: 0,
        y: 0,
        rotationX: 0,
        rotationY: 0,
        duration: 1.2,
        ease: "elastic.out(1, 0.3)"
      });
    };

    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [ref, options.active, options.strength]);
};

export const useSystemLock = (
  ref: RefObject<HTMLElement>,
  isLocked: boolean
) => {
  useEffect(() => {
    if (!ref.current) return;

    if (isLocked) {
      // Lock-in animation: Tighten, dim, focus
      gsap.to(ref.current, {
        scale: 0.98,
        borderColor: "rgba(255, 50, 50, 0.5)", // Red tint
        boxShadow: "0 0 30px rgba(255, 0, 0, 0.1), inset 0 0 20px rgba(0,0,0,0.5)",
        duration: 0.6,
        ease: "expo.out"
      });
    } else {
      // Release
      gsap.to(ref.current, {
        scale: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
        boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)",
        duration: 0.8,
        ease: "elastic.out(1, 0.75)"
      });
    }
  }, [isLocked, ref]);
};

export const useStaggerEntrance = (
  containerRef: RefObject<HTMLElement>,
  selector: string
) => {
  useEffect(() => {
    if (!containerRef.current) return;
    
    const ctx = gsap.context(() => {
      gsap.from(selector, {
        y: 30,
        opacity: 0,
        duration: 0.8,
        stagger: 0.05,
        ease: "back.out(1.7)",
        clearProps: "all"
      });
    }, containerRef);

    return () => ctx.revert();
  }, [containerRef, selector]);
};
