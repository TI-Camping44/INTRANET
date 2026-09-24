/** @type {import('next').NextConfig} */
const configuracion = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: false },
  experimental: {
    serverActions: { bodySizeLimit: "21mb" },

    /**
     * PDF.js NO se empaqueta: se carga de `node_modules` al ejecutar.
     *
     * Empaquetada, Next reescribe la referencia interna que la biblioteca
     * hace al archivo que dibuja y descomprime —su «worker»— y la deja
     * apuntando a un archivo que no existe:
     *
     *   Cannot find module '/var/task/.next/server/chunks/pdf.worker.mjs'
     *
     * Eso rompio la indexacion de 22 de 23 documentos en produccion,
     * andando bien en local, donde no se empaqueta nada. Declarandola
     * externa, la biblioteca resuelve sus propios archivos como lo hace
     * en cualquier servidor de Node.
     */
    serverComponentsExternalPackages: ["pdfjs-dist"],

    /**
     * Y ademas sus archivos tienen que VIAJAR con la funcion.
     *
     * Next empaqueta cada funcion con lo que detecta que usa, y a estos
     * no los detecta: el worker y las fuentes se cargan por ruta, no por
     * `import`. Sin declararlos, la funcion sale sin ellos.
     *
     * Va DENTRO de `experimental`. En Next 14 esta clave se lee de aca; el
     * nombre sin prefijo es de Next 15 y se ignora en silencio, que es
     * como se me paso la primera vez: lo declare afuera, la compilacion no
     * protesto y el archivo igual no viajaba.
     */
    outputFileTracingIncludes: {
      "/api/cron/indexar-documentos": [
        "./node_modules/pdfjs-dist/legacy/build/**",
        "./node_modules/pdfjs-dist/standard_fonts/**",
      ],
      "/documentos/**": [
        "./node_modules/pdfjs-dist/legacy/build/**",
        "./node_modules/pdfjs-dist/standard_fonts/**",
      ],
    },
  },

};

export default configuracion;
