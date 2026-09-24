/** @type {import('next').NextConfig} */
const configuracion = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: false },
  experimental: { serverActions: { bodySizeLimit: "21mb" } },

  /**
   * PDF.js se usa en el servidor para leer el texto de los documentos.
   * Next empaqueta cada funcion con lo que detecta que usa, y a estos
   * archivos no los detecta: la compilacion «legacy» y las fuentes base
   * se cargan por ruta, no por `import`. Sin declararlos, la funcion sale
   * sin ellos y la extraccion falla en produccion aunque ande local.
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
};

export default configuracion;
