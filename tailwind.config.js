/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
    screens: {
      'sm': '1320px',  // PC 端断点：≥1320px 为 PC，<1320px 为手机竖屏
      'md': '1320px',  // 统一使用 1320px
      'lg': '1320px',
      'xl': '1320px',
      '2xl': '1320px',
    },
  },
  plugins: [],
}

