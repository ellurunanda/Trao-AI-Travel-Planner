/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx,mdx}'],
  theme: {
    extend: {
      boxShadow: {
        soft: '0 20px 50px -25px rgba(15, 23, 42, 0.7)'
      }
    }
  },
  plugins: []
};
