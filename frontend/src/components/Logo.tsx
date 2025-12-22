

export const Logo = ({ className = "w-10 h-10" }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="0"
    >
        <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FB2C36" /> {/* neon-red */}
                <stop offset="100%" stopColor="#F92672" /> {/* slightly different red/pink */}
            </linearGradient>
        </defs>

        {/* Outer Hexagon/Shield Shape */}
        <path
            d="M50 5 L93.3 30 V80 L50 95 L6.7 80 V30 Z"
            fill="none"
            stroke="url(#logoGradient)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
        />

        {/* Inner Eye / Shutter Shape */}
        <g transform="translate(50, 50)">
            <path d="M-25 0 Q-15 -20 0 -20 Q15 -20 25 0 Q15 20 0 20 Q-15 20 -25 0"
                fill="none"
                stroke="url(#logoGradient)"
                strokeWidth="3" />
            <circle cx="0" cy="0" r="8" fill="url(#logoGradient)" />
        </g>

        {/* Tech Accents */}
        <path d="M50 15 V25" stroke="url(#logoGradient)" strokeWidth="2" />
        <path d="M50 85 V75" stroke="url(#logoGradient)" strokeWidth="2" />
        <path d="M15 50 H25" stroke="url(#logoGradient)" strokeWidth="2" />
        <path d="M85 50 H75" stroke="url(#logoGradient)" strokeWidth="2" />
    </svg>
);
