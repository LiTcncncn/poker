/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        rl: {
          bg:      '#0B1220',
          surface: '#131E30',
          border:  '#1E2D40',
          gold:    '#F5C842',
          green:   '#4ADE80',
          blue:    '#60A5FA',
          purple:  '#C084FC',
          red:     '#F87171',
        },
      },
      animation: {
        'card-flip': 'cardFlip 250ms ease-out',
        'score-pop': 'scorePop 400ms ease-out',
        'slide-up':  'slideUp 300ms ease-out',
        'fade-in':   'fadeIn 200ms ease-out',
      },
      keyframes: {
        cardFlip: {
          '0%':   { transform: 'rotateY(180deg)' },
          '100%': { transform: 'rotateY(0deg)' },
        },
        scorePop: {
          '0%':   { transform: 'scale(0.8)', opacity: '0' },
          '60%':  { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)',   opacity: '1' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
    },
  },
  plugins: [],
}
