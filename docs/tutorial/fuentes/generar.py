# -*- coding: utf-8 -*-
"""Genera los cuadros del video tutorial de acceso a la intranet."""
import os

V = os.path.dirname(os.path.abspath(__file__))

URL = "intranet-sgc-camping44.vercel.app"

CABEZA = """<!doctype html><html lang="es"><head><meta charset="utf-8">
<link rel="stylesheet" href="base.css"></head><body><div class="lienzo">"""
PIE = """</div></body></html>"""

MARCA = '<div class="marca">INTRANET · CAMPING 44 S.A.</div>'

def tilde(texto):
    return texto

# Flecha curva que entra desde la derecha y apunta a la izquierda-abajo.
FLECHA = """
<svg width="340" height="200" viewBox="0 0 340 200" fill="none"
     style="position:absolute;{pos};filter:drop-shadow(0 10px 24px rgba(0,0,0,.45))">
  <path d="M320 24 C 250 10, 120 34, 64 96" stroke="#E01E37" stroke-width="9"
        stroke-linecap="round" fill="none"/>
  <path d="M58 104 L 96 84 L 86 118 Z" fill="#E01E37"/>
</svg>"""

def escribir(nombre, cuerpo):
    with open(os.path.join(V, nombre), "w", encoding="utf-8") as f:
        f.write(CABEZA + cuerpo + PIE)

# ---------------------------------------------------------------- 01 portada
escribir("f01.html", """
<img src="img/logo.png" style="width:300px;margin-bottom:44px">
<h1>Cómo ingresar<br>a la <span class="rojo">Intranet</span></h1>
<p class="bajada">Camping 44 S.A. · Vitalica E.A.S.</p>
<div class="pie">Dura un minuto. No hace falta instalar nada.</div>
""")

# ------------------------------------------------------------- 02 tres pasos
escribir("f02.html", MARCA + """
<h2>Son tres pasos</h2>
<div style="display:flex;gap:40px;margin-top:66px">
  <div style="width:380px;background:#1C1F27;border:1px solid #2F343E;border-radius:16px;padding:38px 34px">
    <div style="font-size:60px;font-weight:800;color:#E01E37;line-height:1">1</div>
    <div style="font-size:30px;font-weight:700;margin-top:14px">Abra el enlace</div>
    <div style="font-size:23px;color:#A9B1BD;margin-top:10px;line-height:1.45">Desde la computadora o el celular</div>
  </div>
  <div style="width:380px;background:#1C1F27;border:1px solid #2F343E;border-radius:16px;padding:38px 34px">
    <div style="font-size:60px;font-weight:800;color:#E01E37;line-height:1">2</div>
    <div style="font-size:30px;font-weight:700;margin-top:14px">Continuar con Google</div>
    <div style="font-size:23px;color:#A9B1BD;margin-top:10px;line-height:1.45">Un solo botón en la pantalla</div>
  </div>
  <div style="width:380px;background:#1C1F27;border:1px solid #2F343E;border-radius:16px;padding:38px 34px">
    <div style="font-size:60px;font-weight:800;color:#E01E37;line-height:1">3</div>
    <div style="font-size:30px;font-weight:700;margin-top:14px">Elija su cuenta</div>
    <div style="font-size:23px;color:#A9B1BD;margin-top:10px;line-height:1.45">La del trabajo, no la personal</div>
  </div>
</div>
<div class="nota" style="margin-top:56px">No se crea usuario ni contraseña nueva:<br>
entra con la misma cuenta con la que abre su correo.</div>
""")

# ----------------------------------------------------------- 03 paso 1 enlace
escribir("f03.html", MARCA + """
<div class="paso">Paso 1</div>
<h2>Abra este enlace</h2>
<div style="margin-top:52px;background:#fff;color:#14161B;border-radius:14px;
     padding:34px 54px;font-size:46px;font-weight:700;letter-spacing:-.02em;
     box-shadow:0 30px 70px rgba(0,0,0,.55);display:flex;align-items:center;gap:22px">
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#E01E37" stroke-width="2.2"
       stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="4"/>
       <path d="M3 9h18M8 3v6"/></svg>
  """ + URL + """
</div>
<div class="nota" style="margin-top:46px">Se lo enviamos por correo y por WhatsApp.<br>
Conviene guardarlo en favoritos: lo va a usar todos los días.</div>
""")

# ------------------------------------------- 04 y 05 paso 2 (captura real)
# DONDE CAE EL BOTON EN LA CAPTURA, calculado y no puesto a ojo.
#
# La captura se toma a 1280 px de ancho y se dibuja dentro de
# `.navegador`, que mide 1180 con 1 px de borde, asi que la imagen entra
# a 1178 y todo lo que esta adentro se achica en la misma proporcion.
# Arriba de la imagen va la barra del navegador, 62 px, mas el borde.
#
# BOTON_* es lo que mide `getByRole("button", {name: /Google/})` en la
# pantalla real de ingreso. Si la pantalla cambia, se vuelve a medir y
# el anillo sigue cayendo donde tiene que caer; con el numero puesto a
# mano, el anillo se queda donde estaba y señala el lugar equivocado.
ANCHO_CAPTURA = 1280.0
ANCHO_NAVEGADOR = 1178.0
ALTO_BARRA = 63.0
BOTON_CENTRO_X = 640.0
BOTON_CENTRO_Y = 538.6

_escala = ANCHO_NAVEGADOR / ANCHO_CAPTURA
ANILLO_X = round(1 + BOTON_CENTRO_X * _escala)
ANILLO_Y = round(ALTO_BARRA + BOTON_CENTRO_Y * _escala)


def paso_dos(ancho, alto, grosor):
    anillo = ("""<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:{h}px;
        margin-left:-{mw}px;margin-top:-{mh}px;border:{g}px solid #E01E37;border-radius:999px;
        opacity:.95"></div>""").format(x=ANILLO_X, y=ANILLO_Y,
                                        w=ancho, h=alto, mw=ancho // 2, mh=alto // 2, g=grosor)
    return MARCA + """
<div class="paso">Paso 2</div>
<h2 style="margin-bottom:40px">Toque «Continuar con Google»</h2>
<div style="position:relative">
<div class="navegador">
  <div class="barra">
    <span class="punto" style="background:#FF5F57"></span>
    <span class="punto" style="background:#FEBC2E"></span>
    <span class="punto" style="background:#28C840"></span>
    <div class="url">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#28C840" stroke-width="2.4">
        <rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
      """ + URL + """
    </div>
  </div>
  <img src="img/ingreso.png" alt="">
</div>
  """ + anillo + """
  """ + FLECHA.format(pos="left:770px;top:452px") + """
  <div class="rotulo" style="left:1058px;top:424px;white-space:nowrap">Es el único botón</div>
</div>
"""

# El anillo abraza al boton y NO SE COME LA LINEA DE ARRIBA: con 86 y
# 104 px de alto tapaba «del dominio camping44.com.py o
# vitalica.com.py», que es justamente el dato que la persona tiene
# que leer antes de apretar.
escribir("f04.html", paso_dos(360, 70, 7))
escribir("f05.html", paso_dos(392, 84, 9))

# -------------------------------------------------------- 06 paso 3 la cuenta
escribir("f06.html", MARCA + """
<div class="paso">Paso 3</div>
<h2 style="margin-bottom:40px">Elija su cuenta del trabajo</h2>
<div style="position:relative">
  <div class="esquema">
    <div class="tit">Elegir una cuenta</div>
    <div class="sub">para continuar a la Intranet de Camping 44</div>
    <div class="cuenta ok">
      <div class="avatar">N</div>
      <div><div style="font-weight:600">Nombre Apellido</div>
           <div class="correo">nombre.apellido@camping44.com.py</div></div>
    </div>
    <div class="cuenta no">
      <div class="avatar gris">N</div>
      <div><div style="font-weight:600">Nombre personal</div>
           <div class="correo">sucuenta@gmail.com</div></div>
    </div>
  </div>
  """ + FLECHA.format(pos="left:640px;top:74px") + """
  <div class="rotulo" style="left:940px;top:46px">La que termina en<br>camping44.com.py</div>
</div>
<div class="nota" style="margin-top:38px">Si usa Vitalica, la suya termina en <b style="color:#F7F8FA">vitalica.com.py</b>.<br>
Es una pantalla de Google: la de siempre.</div>
""")

# ------------------------------------------------------- 07 aviso personal
escribir("f07.html", MARCA + """
<div style="width:150px;height:150px;border-radius:999px;background:rgba(224,30,55,.14);
     display:flex;align-items:center;justify-content:center;margin-bottom:40px">
  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#E01E37" stroke-width="2"
       stroke-linecap="round"><path d="M12 9v5M12 17.5v.01"/>
       <path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
</div>
<h2>Con el Gmail personal<br>no va a entrar</h2>
<div class="nota" style="margin-top:34px;font-size:31px">La pantalla le va a decir
<i>«Esa cuenta no pertenece a camping44.com.py o vitalica.com.py»</i>.<br>
Vuelva atrás y elija la cuenta del trabajo.</div>
""")

# ----------------------------------------------------------------- 08 listo
escribir("f08.html", MARCA + """
<div style="width:150px;height:150px;border-radius:999px;background:rgba(224,30,55,.14);
     display:flex;align-items:center;justify-content:center;margin-bottom:40px">
  <svg width="84" height="84" viewBox="0 0 24 24" fill="none" stroke="#E01E37" stroke-width="2.6"
       stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>
</div>
<h2>Listo. Ya está adentro.</h2>
<div class="nota" style="margin-top:34px;font-size:31px">
La primera vez el sistema crea su perfil solo, con su nombre y su puesto.<br>
De ahí en más entra directo, sin volver a elegir la cuenta.</div>
""")

# --------------------------------------------------------------- 09 celular
escribir("f09.html", MARCA + """
<div style="display:flex;align-items:center;gap:100px">
  <div class="telefono"><img src="img/celular.png" alt=""></div>
  <div style="max-width:780px">
    <h2 style="text-align:left;font-size:58px">También desde<br>el celular</h2>
    <div class="lista" style="margin-top:36px">
      Mismo enlace, misma cuenta.<br>
      Sin aplicación para instalar.<br>
      Conviene <b>agregarlo a la pantalla de inicio</b>.
    </div>
  </div>
</div>
""")

# ---------------------------------------------------------- 10 si algo falla
escribir("f10.html", MARCA + """
<h2 style="margin-bottom:54px">Si algo no funciona</h2>
<div style="display:flex;flex-direction:column;gap:26px;width:1300px">
  <div style="display:flex;gap:28px;background:#1C1F27;border:1px solid #2F343E;
       border-radius:14px;padding:30px 34px">
    <div style="color:#E01E37;font-size:28px;font-weight:800;white-space:nowrap">«Esa cuenta no pertenece…»</div>
    <div style="font-size:28px;color:#A9B1BD">Eligió el Gmail personal. Vuelva a empezar y elija el del trabajo.</div>
  </div>
  <div style="display:flex;gap:28px;background:#1C1F27;border:1px solid #2F343E;
       border-radius:14px;padding:30px 34px">
    <div style="color:#E01E37;font-size:28px;font-weight:800;white-space:nowrap">«Su usuario está inactivo»</div>
    <div style="font-size:28px;color:#A9B1BD">Escriba a TI para que lo habiliten.</div>
  </div>
  <div style="display:flex;gap:28px;background:#1C1F27;border:1px solid #2F343E;
       border-radius:14px;padding:30px 34px">
    <div style="color:#E01E37;font-size:28px;font-weight:800;white-space:nowrap">Queda en blanco</div>
    <div style="font-size:28px;color:#A9B1BD">Cierre la pestaña, abra el enlace de nuevo y pruebe otra vez.</div>
  </div>
</div>
""")

# ----------------------------------------------------------------- 11 cierre
escribir("f11.html", """
<img src="img/logo.png" style="width:210px;margin-bottom:40px">
<h2 style="font-size:52px">Intranet · Sistema de Gestión de Calidad</h2>
<div style="margin-top:44px;background:#fff;color:#14161B;border-radius:14px;
     padding:28px 46px;font-size:40px;font-weight:700;letter-spacing:-.02em;
     box-shadow:0 30px 70px rgba(0,0,0,.55)">""" + URL + """</div>
<div class="nota" style="margin-top:44px">¿Dudas? Escriba a TI.</div>
""")

print("cuadros escritos:", sorted(x for x in os.listdir(V) if x.endswith(".html")))
