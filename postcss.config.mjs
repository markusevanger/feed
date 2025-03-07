

/** @type {import('tailwindcss').Config} */
const config = {

  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
  ],


  plugins: ["@tailwindcss/postcss"],


};



export default config;
