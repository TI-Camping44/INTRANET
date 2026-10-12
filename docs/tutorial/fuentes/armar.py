# -*- coding: utf-8 -*-
"""Arma el video a partir de los cuadros, con fundidos encadenados."""
import os, subprocess

V = os.path.dirname(os.path.abspath(__file__))
# De donde sale ffmpeg: la variable de entorno manda, y si no hay se
# busca el binario de `ffmpeg-static` junto al script y despues en el
# PATH. Estaba apuntado a una carpeta que no existe en el repositorio,
# asi que armar.py no corria en una maquina limpia.
FFMPEG = (
    os.environ.get("FFMPEG")
    or next(
        (c for c in [
            os.path.join(V, "node_modules", "ffmpeg-static", "ffmpeg"),
            os.path.join(os.path.dirname(V), "node_modules", "ffmpeg-static", "ffmpeg"),
        ] if os.path.exists(c)),
        None,
    )
    or "ffmpeg"
)

# (cuadro, segundos en pantalla, segundos de fundido hacia el siguiente)
GUION = [
    ("f01", 3.6, 0.5),   # portada
    ("f02", 5.0, 0.5),   # son tres pasos
    ("f03", 5.2, 0.5),   # paso 1: el enlace
    ("f04", 2.3, 0.2),   # paso 2: el boton
    ("f05", 2.3, 0.2),   # paso 2: el boton (latido)
    ("f06", 5.6, 0.5),   # paso 3: la cuenta
    ("f07", 4.4, 0.5),   # aviso cuenta personal
    ("f08", 4.2, 0.5),   # listo
    ("f09", 4.6, 0.5),   # celular
    ("f10", 5.8, 0.5),   # si algo falla
    ("f11", 4.2, 0.0),   # cierre
]

orden = []
for nombre, duracion, _ in GUION:
    orden += ["-loop", "1", "-t", str(duracion), "-i", os.path.join(V, "cuadros", nombre + ".png")]

filtros = []
etiqueta = "[0:v]"
desplazamiento = 0.0
for i in range(len(GUION) - 1):
    fundido = GUION[i][2]
    desplazamiento += GUION[i][1] - fundido
    salida = "[v%d]" % (i + 1)
    filtros.append("%s[%d:v]xfade=transition=fade:duration=%.2f:offset=%.2f%s"
                   % (etiqueta, i + 1, fundido, desplazamiento, salida))
    etiqueta = salida

total = sum(d for _, d, _ in GUION) - sum(f for _, _, f in GUION)
filtros.append("%sformat=yuv420p[vf]" % etiqueta)

# El video terminado va junto a la hoja, no entre las fuentes: en
# `fuentes/` queda lo que se edita y lo que se genera se ignora.
salida = os.path.join(os.path.dirname(V), "intranet-camping44-como-ingresar.mp4")
orden += [
    "-f", "lavfi", "-t", "%.2f" % total, "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
    "-filter_complex", ";".join(filtros),
    "-map", "[vf]", "-map", "%d:a" % len(GUION),
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
    "-r", "30", "-c:a", "aac", "-b:a", "64k", "-shortest",
    "-movflags", "+faststart", "-y", salida,
]

print("duracion prevista: %.1f s" % total)
res = subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error"] + orden)
print("ffmpeg salio con", res.returncode)
