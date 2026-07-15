/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          dark: {
            950: '#020617', // Very deep blue-black
            900: '#04111f',
            800: '#0a1d33',
            700: '#0f2942',
          },
          brand: {
            light: '#7dd3fc', // Cyan
            DEFAULT: '#38bdf8', // Electric blue
            dark: '#0284c7', // Deep blue
          },
          accent: {
            DEFAULT: '#8b5cf6', // Subtle purple
          }
        },
        animation: {
          'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          'glow': 'glow 2s ease-in-out infinite alternate',
          'float': 'float 3s ease-in-out infinite',
          'scan': 'scan 2s ease-in-out infinite',
          'fade-in': 'fadeIn 0.6s ease-out forwards',
          'slide-up': 'slideUp 0.6s ease-out forwards',
        },
        keyframes: {
          glow: {
            '0%': { boxShadow: '0 0 10px rgba(56, 189, 248, 0.2)' },
            '100%': { boxShadow: '0 0 25px rgba(56, 189, 248, 0.6)' },
          },
          float: {
            '0%, 100%': { transform: 'translateY(0)' },
            '50%': { transform: 'translateY(-10px)' },
          },
          scan: {
            '0%': { transform: 'translateX(-100%)' },
            '100%': { transform: 'translateX(100%)' },
          },
          fadeIn: {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' },
          },
          slideUp: {
            '0%': { opacity: '0', transform: 'translateY(20px)' },
            '100%': { opacity: '1', transform: 'translateY(0)' },
          }
        }
      },
    },
    plugins: [],
  }