/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'var(--font-geist)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-butler)', 'Georgia', 'serif'],
        satoshi: ['var(--font-satoshi)', 'Arial', 'Helvetica', 'sans-serif'],
        'butler-medium': ['var(--font-butler-medium)', 'Georgia', 'serif'],
        'butler-semibold': ['var(--font-butler-semibold)', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
