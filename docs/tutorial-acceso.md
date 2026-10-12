# Tutorial de acceso · cómo ingresar a la Intranet

Material para repartir a las 55 personas del padrón. Está en
`docs/tutorial/`:

| Archivo | Para qué |
| --- | --- |
| `intranet-camping44-como-ingresar.mp4` | Video de 43 segundos, 1080p, 1,5 MB. Entra por WhatsApp y por correo |
| `como-ingresar-a-la-intranet.png` | La misma guía en una imagen. Se pega en el cuerpo del correo o se manda por WhatsApp |
| `como-ingresar-a-la-intranet.pdf` | Dos carillas A4, para imprimir y pegar en depósito y piso de venta |

El video **no tiene voz**: todo lo dice en pantalla. Así se puede mirar
sin auriculares en el piso de venta, que es donde se va a mirar.

---

## Lo que dice el tutorial

El ingreso es más corto de lo que la gente espera, y eso es lo primero
que hay que decirles: **no hay usuario ni contraseña nueva**. Se entra
con la misma cuenta de Google con la que abren el correo del trabajo.

1. Abrir `https://intranet-sgc-camping44.vercel.app`
2. Tocar **Continuar con Google** — es el único botón de la pantalla.
3. Elegir la cuenta que termina en `camping44.com.py` o en
   `vitalica.com.py`.

La primera vez el perfil se crea solo, con el nombre y el puesto que
trae el padrón. De ahí en más el navegador recuerda la sesión y entran
directo.

### Los tres errores que van a aparecer

| Lo que ve la persona | Qué pasó |
| --- | --- |
| «Esa cuenta no pertenece a camping44.com.py o vitalica.com.py» | Eligió el Gmail personal. Es el caso más común |
| «Su usuario está inactivo» | El Administrador SGC lo desactivó. Lo resuelve TI |
| La pantalla queda en blanco | Pestaña vieja recargada. Se abre el enlace de nuevo |

Los tres están en el tutorial, con su solución, porque son los tres que
generan la llamada a TI.

---

## Texto para enviar

### Correo

> **Asunto:** Ya pueden entrar a la Intranet de Camping 44
>
> Buen día,
>
> Desde hoy está disponible la Intranet de Camping 44: novedades de la
> empresa, cumpleaños, directorio de personas, y los módulos del Sistema
> de Gestión de Calidad.
>
> **Para entrar:** https://intranet-sgc-camping44.vercel.app
>
> No hay que crear usuario ni contraseña. Se ingresa con la misma cuenta
> de Google con la que abren su correo del trabajo: abran el enlace,
> toquen «Continuar con Google» y elijan su cuenta
> @camping44.com.py (o @vitalica.com.py).
>
> Adjunto va un video de 40 segundos con el paso a paso, y la misma guía
> en una hoja por si prefieren imprimirla.
>
> Conviene guardar el enlace en favoritos. También funciona desde el
> celular, sin instalar nada.
>
> Cualquier problema para entrar, escríbanme.

### WhatsApp

> Buen día. Ya está disponible la Intranet de Camping 44 👉
> https://intranet-sgc-camping44.vercel.app
>
> No hace falta usuario ni contraseña: se entra con la cuenta de Google
> del trabajo (la de @camping44.com.py). Tocan el enlace, después
> «Continuar con Google» y eligen su cuenta.
>
> Les mando un video cortito con el paso a paso. Anda también desde el
> celular.

> Por WhatsApp conviene mandar el video **y** la imagen: el video no lo
> abre todo el mundo, la imagen se ve en la conversación.

---

## Por qué el tutorial no muestra la pantalla de Google de verdad

El paso 3 es un dibujo del selector de cuentas, no una captura. Es a
propósito: una imitación exacta de una pantalla de ingreso de Google,
circulando por WhatsApp, es justo lo que entrena a la gente a confiar en
una pantalla que se parece. El dibujo alcanza para reconocer el paso y
no sirve de molde para nadie.

Por la misma razón el tutorial repite la dirección completa del sistema
en la portada y en el cierre: lo que la gente tiene que aprender a
mirar es la barra de direcciones.

---

## Cómo rehacerlo cuando cambie la pantalla de ingreso

Las fuentes están en `docs/tutorial/fuentes/`. La captura del paso 2 es
real: sale de la aplicación compilada, no es un dibujo, así que cuando
`ingresar/page.tsx` cambie hay que volver a sacarla.

```bash
npm run build && npm start              # la aplicación en localhost:3000

# 1. la captura real de la pantalla de ingreso
chromium --headless=new --force-device-scale-factor=2 \
  --window-size=1280,820 --screenshot=ingreso.png \
  http://localhost:3000/ingresar

# 2. los cuadros del video y la hoja
python3 fuentes/generar.py              # escribe f01.html … f11.html
#    y se capturan igual, con --window-size=1920,1080

# 3. el video
python3 fuentes/armar.py                # une los cuadros con fundidos
```

`armar.py` necesita un `ffmpeg` completo —el que trae Playwright solo
exporta WebM, que no abre en iPhone ni en WhatsApp—. Se consigue con
`npm install ffmpeg-static` **fuera del proyecto**: es una herramienta
para armar el material, no una dependencia del sistema.

El recorte del paso 2 y la posición de la elipse y la flecha están en
`fuentes/hoja.html` como porcentajes del alto de la imagen. Si el botón
se mueve en la pantalla, se corrige ahí.

---

## Lo que falta

El **manual de uso** —qué hace cada módulo, no cómo entrar— no está
hecho. Necesita capturas de las pantallas de adentro, y esas no se
pueden sacar sin una sesión iniciada con una cuenta del dominio.
