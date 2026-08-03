/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        main: '#06111D',
        surface: {
          DEFAULT: '#0C1B2A',
          soft: '#122334',
          raised: '#17293C',
        },
        accent: {
          DEFAULT: '#C1121F',
          hover: '#E01A28',
          soft: '#3A1016',
        },
        gold: '#F2B705',
        txt: {
          DEFAULT: '#F5F5DC',
          muted: '#A9B4C0',
          dim: '#6B7A8C',
        },
        border: {
          DEFAULT: 'rgba(245, 245, 220, 0.08)',
          strong: 'rgba(245, 245, 220, 0.16)',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
        script: ['"Dancing Script"', 'cursive'],
      },
      boxShadow: {
        card: '0 8px 24px -8px rgba(0, 0, 0, 0.5)',
        raised: '0 20px 40px -16px rgba(0, 0, 0, 0.6)',
        glow: '0 0 0 1px rgba(193, 18, 31, 0.4), 0 0 24px rgba(193, 18, 31, 0.35)',
        'glow-gold': '0 0 24px rgba(242, 183, 5, 0.3)',
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #C1121F 0%, #7A0C14 100%)',
        'hero-fade':
          'linear-gradient(to top, #06111D 0%, rgba(6,17,29,0.85) 30%, rgba(6,17,29,0.35) 65%, rgba(6,17,29,0.05) 100%)',
        'surface-fade': 'linear-gradient(180deg, rgba(6,17,29,0) 0%, #06111D 100%)',
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
        'slide-up': 'slide-up 0.4s ease-out',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        'slide-up': {
          '0%': { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
