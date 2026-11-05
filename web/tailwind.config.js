/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        jira: {
          blue: '#0052CC',
          darkBlue: '#172B4D',
          lightBlue: '#DEEBFF',
          gray: '#F4F5F7',
          border: '#DFE1E6',
          text: '#172B4D',
          subtle: '#6B778C',
        }
      }
    },
  },
  plugins: [],
}
