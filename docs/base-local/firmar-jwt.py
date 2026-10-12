# -*- coding: utf-8 -*-
"""Firma el JWT que PostgREST valida, para probar la base local.

El secreto sale de PGRST_JWT_SECRET: el mismo que se le pasa a
PostgREST. No se escribe en el repositorio.

    export PGRST_JWT_SECRET=$(openssl rand -base64 48)
    python3 firmar-jwt.py e1000000-0000-4000-8000-000000000002 \
        demo.calidad@camping44.com.py
"""
import base64, hashlib, hmac, json, os, sys

SECRETO = os.environ.get("PGRST_JWT_SECRET")
if not SECRETO:
    sys.exit("Falta PGRST_JWT_SECRET.")


def b64(d):
    return base64.urlsafe_b64encode(d).rstrip(b"=").decode()


def firmar(sub, correo, rol="authenticated"):
    cab = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    cuerpo = b64(json.dumps({
        "aud": "authenticated", "role": rol, "sub": sub, "email": correo,
        "iat": 1760000000, "exp": 4102444800,
    }, separators=(",", ":")).encode())
    sin_firma = (cab + "." + cuerpo).encode()
    return cab + "." + cuerpo + "." + b64(
        hmac.new(SECRETO.encode(), sin_firma, hashlib.sha256).digest())


if __name__ == "__main__":
    print(firmar(sys.argv[1], sys.argv[2]))
