/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // macOS style colors
        mac: {
          bg: "#1e1e1e",
          surface: "#2d2d2d",
          overlay: "#3d3d3d",
          border: "rgba(255, 255, 255, 0.1)",
          text: "#ffffff",
          textSecondary: "#a0a0a0",
          accent: "#007aff",
          accentHover: "#0051d5",
          success: "#34c759",
          warning: "#ff9500",
          danger: "#ff3b30",
          purple: "#af52de",
        },
        // Keep neon colors for penalty states
        neon: {
          red: "#ff3b30",
          green: "#34c759",
          blue: "#007aff",
          purple: "#af52de",
          yellow: "#ff9500",
          orange: "#ff9500",
          // Gradient mix colors
          'green-mix-10': 'rgba(52, 199, 89, 0.1)',
          'green-mix-20': 'rgba(52, 199, 89, 0.2)',
          'green-mix-50': 'rgba(52, 199, 89, 0.5)',
          'yellow-mix-10': 'rgba(255, 149, 0, 0.1)',
          'yellow-mix-20': 'rgba(255, 149, 0, 0.2)',
          'yellow-mix-50': 'rgba(255, 149, 0, 0.5)',
          'orange-mix-10': 'rgba(255, 149, 0, 0.1)',
          'orange-mix-20': 'rgba(255, 149, 0, 0.2)',
          'orange-mix-50': 'rgba(255, 149, 0, 0.5)',
          'red-mix-10': 'rgba(255, 59, 48, 0.1)',
          'red-mix-20': 'rgba(255, 59, 48, 0.2)',
          'red-mix-50': 'rgba(255, 59, 48, 0.5)',
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "1rem",
        "2xl": "1.5rem",
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        'mac': '0 4px 30px rgba(0, 0, 0, 0.1)',
        'mac-lg': '0 10px 40px rgba(0, 0, 0, 0.2)',
        'mac-inner': 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        'glow-blue': '0 0 20px rgba(0, 122, 255, 0.5)',
        'glow-green': '0 0 20px rgba(52, 199, 89, 0.5)',
        'glow-red': '0 0 20px rgba(255, 59, 48, 0.5)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: 0 },
          "100%": { transform: "scale(1)", opacity: 1 },
        },
        "slide-up": {
          "0%": { transform: "translateY(10px)", opacity: 0 },
          "100%": { transform: "translateY(0)", opacity: 1 },
        },
        "slide-down": {
          "0%": { transform: "translateY(-10px)", opacity: 0 },
          "100%": { transform: "translateY(0)", opacity: 1 },
        },
        "fade-in": {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0, 122, 255, 0.5)" },
          "50%": { boxShadow: "0 0 40px rgba(0, 122, 255, 0.8)" },
        },
        "bounce-gentle": {
          "0%, 100%": { transform: "translateY(-5%)" },
          "50%": { transform: "translateY(0)" },
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-3px)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.6 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "float": "float 3s ease-in-out infinite",
        "scale-in": "scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-up": "slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-down": "slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in": "fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "shimmer": "shimmer 2s linear infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "bounce-gentle": "bounce-gentle 2s ease-in-out infinite",
        "bounce-subtle": "bounce-subtle 1s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "scan-line": "scan-line 8s linear infinite",
        "flicker": "flicker 0.15s infinite",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        chinese: ["Noto Sans TC", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        'title': ['clamp(1.5rem, 3vw, 3rem)', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '100': '25rem',
        '120': '30rem',
      },
      transitionTimingFunction: {
        'luxury': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'responsive': 'cubic-bezier(0.33, 1, 0.68, 1)',
      },
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
        '800': '800ms',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
