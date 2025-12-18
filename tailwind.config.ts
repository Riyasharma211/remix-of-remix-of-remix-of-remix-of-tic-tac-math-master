import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        rajdhani: ['Rajdhani', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        neon: {
          cyan: "hsl(var(--neon-cyan))",
          purple: "hsl(var(--neon-purple))",
          pink: "hsl(var(--neon-pink))",
          green: "hsl(var(--neon-green))",
          orange: "hsl(var(--neon-orange))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        "scale-pop": {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "float-up": {
          "0%": { transform: "translateY(0) scale(1)", opacity: "1" },
          "50%": { transform: "translateY(-150px) scale(1.2)", opacity: "0.8" },
          "100%": { transform: "translateY(-300px) scale(0.8)", opacity: "0" },
        },
        "slide-up": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-up-full": {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "scale-in": {
          "0%": { transform: "scale(0)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-4px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(4px)" },
        },
        "screen-shake": {
          "0%, 100%": { transform: "translate(0, 0) rotate(0deg)" },
          "10%": { transform: "translate(-8px, -2px) rotate(-0.5deg)" },
          "20%": { transform: "translate(6px, 4px) rotate(0.5deg)" },
          "30%": { transform: "translate(-6px, 2px) rotate(-0.5deg)" },
          "40%": { transform: "translate(4px, -4px) rotate(0.5deg)" },
          "50%": { transform: "translate(-4px, 2px) rotate(-0.3deg)" },
          "60%": { transform: "translate(4px, -2px) rotate(0.3deg)" },
          "70%": { transform: "translate(-2px, 4px) rotate(-0.2deg)" },
          "80%": { transform: "translate(2px, -2px) rotate(0.2deg)" },
          "90%": { transform: "translate(-2px, 2px) rotate(0deg)" },
        },
        "bounce-gentle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-3px)" },
        },
        "message-pop": {
          "0%": { transform: "translateY(20px) scale(0.9)", opacity: "0" },
          "60%": { transform: "translateY(-4px) scale(1.02)", opacity: "1" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        "message-slide": {
          "0%": { transform: "translateX(30px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "message-slide-left": {
          "0%": { transform: "translateX(-30px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "emoji-pop": {
          "0%": { transform: "scale(0) rotate(-15deg)", opacity: "0" },
          "50%": { transform: "scale(1.3) rotate(10deg)", opacity: "1" },
          "70%": { transform: "scale(0.9) rotate(-5deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        "emoji-float": {
          "0%": { transform: "translateY(0) scale(1) rotate(0deg)", opacity: "1" },
          "25%": { transform: "translateY(-80px) scale(1.1) rotate(-10deg)", opacity: "1" },
          "50%": { transform: "translateY(-160px) scale(1) rotate(10deg)", opacity: "0.9" },
          "75%": { transform: "translateY(-240px) scale(0.9) rotate(-5deg)", opacity: "0.6" },
          "100%": { transform: "translateY(-320px) scale(0.8) rotate(0deg)", opacity: "0" },
        },
        "emoji-wobble": {
          "0%": { transform: "scale(1) rotate(0deg)" },
          "25%": { transform: "scale(1.1) rotate(-8deg)" },
          "50%": { transform: "scale(1.15) rotate(8deg)" },
          "75%": { transform: "scale(1.1) rotate(-4deg)" },
          "100%": { transform: "scale(1) rotate(0deg)" },
        },
        "emoji-burst": {
          "0%": { transform: "scale(0)", opacity: "0" },
          "40%": { transform: "scale(1.4)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "bounce-subtle": "bounce-subtle 0.6s ease-in-out",
        "scale-pop": "scale-pop 0.3s ease-out",
        "float-up": "float-up 2.5s ease-out forwards",
        "slide-up": "slide-up 0.3s ease-out",
        "slide-up-full": "slide-up-full 0.4s ease-out 0.2s both",
        "scale-in": "scale-in 0.3s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "shake": "shake 0.5s ease-in-out",
        "screen-shake": "screen-shake 0.5s ease-in-out",
        "bounce-gentle": "bounce-gentle 1.5s ease-in-out infinite",
        "message-pop": "message-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "message-slide": "message-slide 0.3s ease-out",
        "message-slide-left": "message-slide-left 0.3s ease-out",
        "emoji-pop": "emoji-pop 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "emoji-float": "emoji-float 2.5s ease-out forwards",
        "emoji-wobble": "emoji-wobble 0.5s ease-in-out",
        "emoji-burst": "emoji-burst 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
