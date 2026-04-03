// tailwind.config.js
const { nativewindPreset } = require("nativewind/tailwind/preset");

module.exports = {
  presets: [nativewindPreset],
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};