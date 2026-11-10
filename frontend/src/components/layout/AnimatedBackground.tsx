import React from 'react';

/**
 * AnimatedBackground renders the signature flowing purple/blue ribbon waves
 * and subtle ambient glow seen in the reference design, positioned behind
 * the dashboard content with mobile optimization and reduced motion support.
 */
export const AnimatedBackground: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#FAFBFF] select-none max-w-full"
    >
      {/* Top-Right Flowing Multi-Strand Ribbon Wave (Scales gracefully on mobile) */}
      <svg
        className="absolute top-0 right-0 w-[550px] sm:w-[850px] lg:w-[1100px] h-[220px] sm:h-[300px] lg:h-[380px] opacity-80 sm:opacity-90 overflow-hidden pointer-events-none"
        viewBox="0 0 1100 380"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="refRibbon1" x1="0%" y1="60%" x2="100%" y2="30%">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0" />
            <stop offset="25%" stopColor="#A855F7" stopOpacity="0.5" />
            <stop offset="60%" stopColor="#818CF8" stopOpacity="0.55" />
            <stop offset="85%" stopColor="#C084FC" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#DDD6FE" stopOpacity="0.1" />
          </linearGradient>

          <linearGradient id="refRibbon2" x1="0%" y1="30%" x2="100%" y2="70%">
            <stop offset="0%" stopColor="#C084FC" stopOpacity="0" />
            <stop offset="30%" stopColor="#C084FC" stopOpacity="0.45" />
            <stop offset="65%" stopColor="#93C5FD" stopOpacity="0.45" />
            <stop offset="90%" stopColor="#818CF8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#DDD6FE" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="refRibbon3" x1="10%" y1="0%" x2="90%" y2="100%">
            <stop offset="0%" stopColor="#E9D5FF" stopOpacity="0" />
            <stop offset="40%" stopColor="#DDD6FE" stopOpacity="0.65" />
            <stop offset="75%" stopColor="#BAE6FD" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#F5F3FF" stopOpacity="0" />
          </linearGradient>

          <filter id="ribbonBlur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
        </defs>

        {/* Strand 1: Main graceful sweeping ribbon */}
        <path
          d="M 50 200 C 260 40 480 270 760 110 C 920 20 1020 80 1100 50"
          stroke="url(#refRibbon1)"
          strokeWidth="38"
          strokeLinecap="round"
          fill="none"
          className="animate-wave-slow"
        />

        {/* Strand 2: Overlapping secondary ribbon with soft blue/violet transition */}
        <path
          d="M 140 240 C 350 70 560 300 820 130 C 960 30 1040 95 1100 70"
          stroke="url(#refRibbon2)"
          strokeWidth="24"
          strokeLinecap="round"
          fill="none"
          className="animate-wave-reverse"
        />

        {/* Strand 3: Lighter highlighted ribbon layer */}
        <path
          d="M 220 210 C 410 90 580 260 840 100 C 970 35 1050 75 1100 45"
          stroke="url(#refRibbon3)"
          strokeWidth="16"
          strokeLinecap="round"
          fill="none"
          filter="url(#ribbonBlur)"
        />
      </svg>

      {/* Bottom-Left Fluid Ambient Wave Curve */}
      <svg
        className="absolute bottom-0 left-0 w-[350px] sm:w-[500px] lg:w-[600px] h-[180px] sm:h-[240px] lg:h-[280px] opacity-35 sm:opacity-45 overflow-hidden pointer-events-none"
        viewBox="0 0 600 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M -50 240 C 120 150 250 270 420 180 C 520 120 580 190 620 210"
          stroke="url(#refRibbon2)"
          strokeWidth="42"
          strokeLinecap="round"
          fill="none"
          className="animate-wave-slow"
        />
        <path
          d="M -30 260 C 140 180 270 290 440 210 C 530 150 590 200 620 220"
          stroke="url(#refRibbon1)"
          strokeWidth="20"
          strokeLinecap="round"
          fill="none"
          className="animate-wave-reverse"
        />
      </svg>

      {/* Subtle particle grid - hidden on mobile to maximize battery & performance */}
      <svg
        className="hidden sm:block absolute inset-0 h-full w-full opacity-[0.2]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="subtle-dots"
            x="0"
            y="0"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="0.75" fill="#7C3AED" fillOpacity="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#subtle-dots)" />
      </svg>

      {/* Floating accent particles (hidden on mobile) */}
      <div className="hidden sm:block animate-float-slow absolute top-20 right-[28%] h-2 w-2 rounded-full bg-primary-400/35 blur-[1px]" />
      <div
        className="hidden sm:block animate-float-slow absolute top-36 right-[15%] h-2.5 w-2.5 rounded-full bg-secondary-400/40 blur-[1px]"
        style={{ animationDelay: '2.5s' }}
      />
    </div>
  );
};

export default AnimatedBackground;
