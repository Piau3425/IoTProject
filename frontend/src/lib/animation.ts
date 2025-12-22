import gsap from 'gsap';

// Global GSAP Configuration
gsap.defaults({
  ease: "power2.out",
  duration: 0.6,
});

// Custom Eases (Simulating CustomEase if not available, or defining standard complex eases)
export const EASES = {
  // Heavy physical object starting to move
  heavyStart: "power4.in",
  // Heavy physical object coming to a stop
  heavyStop: "power4.out",
  // Springy mechanical bounce
  spring: "elastic.out(1, 0.5)",
  // Smooth Apple-like transition
  smooth: "expo.out",
  // Precision mechanical movement
  precision: "back.out(1.7)",
};

export const ANIMATION_CONFIG = {
  // Duration for standard UI transitions
  duration: {
    fast: 0.2,
    normal: 0.4,
    slow: 0.8,
    long: 1.2,
  },
  // Stagger delays
  stagger: {
    fast: 0.05,
    normal: 0.1,
  },
};
