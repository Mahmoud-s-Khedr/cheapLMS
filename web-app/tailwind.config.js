/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f8f9ff',
          100: '#f0f4ff',
          500: '#5b5bff',
          600: '#4a4ae6',
          700: '#3939cc',
        },
      },
    },
  },
  plugins: [],
}
