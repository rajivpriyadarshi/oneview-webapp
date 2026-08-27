/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        drawStroke: {
          "0%": { strokeDasharray: "1 300", strokeDashoffset: "0" },
          "50%": { strokeDasharray: "150 300", strokeDashoffset: "-75" },
          "100%": { strokeDasharray: "1 300", strokeDashoffset: "-300" },
        },
        portfolioSkeletonSlide: {
          "0%": { transform: "translateX(-20px)", opacity: "0.55" },
          "50%": { transform: "translateX(22px)", opacity: "1" },
          "100%": { transform: "translateX(-20px)", opacity: "0.55" },
        },
      },
      animation: {
        "draw-stroke": "drawStroke 2s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        "portfolio-skeleton-slide": "portfolioSkeletonSlide 1.2s ease-in-out infinite",
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'var(--font-geist)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-butler)', 'Georgia', 'serif'],
        butler: ['var(--font-butler)', 'Georgia', 'serif'],
        satoshi: ['var(--font-satoshi)', 'Arial', 'Helvetica', 'sans-serif'],
        'butler-medium': ['var(--font-butler-medium)', 'Georgia', 'serif'],
        'butler-semibold': ['var(--font-butler-semibold)', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
