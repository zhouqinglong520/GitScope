/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './renderer/**/*.{js,ts,jsx,tsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        // GitGUI 主题色
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        sidebar: {
          bg: '#1a1a2e',
          hover: '#2d2d2d',
          active: '#37373d',
        },
        panel: {
          bg: '#252526',
          border: '#3c3c3c',
        },
        // 分支颜色
        branch: {
          blue: '#5799da',
          green: '#7dce82',
          orange: '#e2a855',
          purple: '#b47ccf',
          cyan: '#52c4e8',
          red: '#e85d75',
        },
      },
      fontFamily: {
        mono: ['Consolas', 'Monaco', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};
