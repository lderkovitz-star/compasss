import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#020817',
          900: '#0F172A',
          800: '#1E293B',
          700: '#273549',
          600: '#334155',
        },
        brand: {
          DEFAULT: '#2563EB',
          light: '#3B82F6',
          dark: '#1D4ED8',
          glow: '#60A5FA',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'timer-drain': 'timerDrain linear forwards',
        'heartbeat': 'heartbeat 0.8s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        timerDrain: {
          '0%': { strokeDashoffset: '0' },
          '100%': { strokeDashoffset: '283' },
        },
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.2)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.1)' },
          '70%': { transform: 'scale(1)' },
        },
      },
      backgroundImage: {
        'gradient-navy': 'linear-gradient(135deg, #020817 0%, #0F172A 50%, #1E293B 100%)',
        'gradient-brand': 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 50%, #3B82F6 100%)',
        'gradient-card': 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
      },
      boxShadow: {
        'brand': '0 0 24px rgba(37, 99, 235, 0.3)',
        'brand-lg': '0 0 48px rgba(37, 99, 235, 0.4)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
