/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        arabic: ['Cairo', 'Noto Sans Arabic', 'sans-serif'],
        sans: ['Cairo', 'Noto Sans Arabic', 'sans-serif'],
      },
      colors: {
        // Coffee-inspired warm color palette
        coffee: {
          50:  '#fdf8f0',
          100: '#faefd9',
          200: '#f4ddb2',
          300: '#ecc57f',
          400: '#e2a44e',
          500: '#d4872a',
          600: '#c4701f',
          700: '#a3561b',
          800: '#84441d',
          900: '#6c381c',
          950: '#3c1a0a',
        },
        cream: {
          50:  '#fefdf8',
          100: '#fdf9ee',
          200: '#faf1d4',
          300: '#f5e5a8',
          400: '#edd472',
          500: '#e3bc47',
          600: '#c9a030',
        },
        espresso: {
          900: '#1a0f08',
          800: '#2d1a10',
          700: '#4a2c1a',
          600: '#643d25',
        }
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.12), 0 8px 32px rgba(0,0,0,0.08)',
        'sidebar': '2px 0 20px rgba(0,0,0,0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(16px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}
