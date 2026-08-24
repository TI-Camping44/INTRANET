import type { Config } from "tailwindcss";

// Configuracion de Tailwind alineada a la marca de Camping 44:
// rojo institucional #E01E37 (352 76% 50%) y gris tinta #14161B (223 15% 9%).
const configuracion: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1600px" },
    },
    extend: {
      fontFamily: {
        sans: ["var(--fuente-inter)", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        borde: "hsl(var(--borde))",
        entrada: "hsl(var(--entrada))",
        anillo: "hsl(var(--anillo))",
        fondo: "hsl(var(--fondo))",
        texto: "hsl(var(--texto))",
        primario: {
          DEFAULT: "hsl(var(--primario))",
          contraste: "hsl(var(--primario-contraste))",
        },
        secundario: {
          DEFAULT: "hsl(var(--secundario))",
          contraste: "hsl(var(--secundario-contraste))",
        },
        destructivo: {
          DEFAULT: "hsl(var(--destructivo))",
          contraste: "hsl(var(--destructivo-contraste))",
        },
        atenuado: {
          DEFAULT: "hsl(var(--atenuado))",
          contraste: "hsl(var(--atenuado-contraste))",
        },
        acento: {
          DEFAULT: "hsl(var(--acento))",
          contraste: "hsl(var(--acento-contraste))",
        },
        tarjeta: {
          DEFAULT: "hsl(var(--tarjeta))",
          contraste: "hsl(var(--tarjeta-contraste))",
        },
        emergente: {
          DEFAULT: "hsl(var(--emergente))",
          contraste: "hsl(var(--emergente-contraste))",
        },
        // Semaforo del sistema de gestion (riesgos, estados y vencimientos).
        semaforo: {
          bajo: "hsl(var(--semaforo-bajo))",
          medio: "hsl(var(--semaforo-medio))",
          alto: "hsl(var(--semaforo-alto))",
          critico: "hsl(var(--semaforo-critico))",
        },
      },
      borderRadius: {
        lg: "var(--radio)",
        md: "calc(var(--radio) - 2px)",
        sm: "calc(var(--radio) - 4px)",
      },
      keyframes: {
        "acordeon-abrir": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "acordeon-cerrar": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "acordeon-abrir": "acordeon-abrir 0.2s ease-out",
        "acordeon-cerrar": "acordeon-cerrar 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default configuracion;
