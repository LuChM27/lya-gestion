# Base ejecutable en la Mac — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar instalada en la MacBook Air 2017 una versión 0.1.0 de L&A Gestión que arranca sola con launchd, pide inicio de sesión, se abre desde el Dock, se enciende y apaga desde la barra de menú y se ve desde el iPhone por el QR, sin ningún módulo de negocio todavía.

**Architecture:** Un proceso Python (FastAPI sobre Uvicorn) sirve la API en `/api/*` y la interfaz React compilada, con SQLite en `DATA_DIR`. GitHub Actions arma un `.tar.gz` por arquitectura con Python autónomo, dependencias e interfaz; `instalar.sh` lo instala en `~/LyA`, registra dos LaunchAgents y compila el lanzador del Dock. Es el primer plan de la Fase 1: valida la parte más incierta (empaquetado para macOS 12 Intel) antes de construir módulos encima.

**Tech Stack:** Python 3.13, uv, FastAPI, Uvicorn, SQLAlchemy 2, Alembic, argon2-cffi, rumps; React + Vite + TypeScript, Tailwind CSS, Vitest; python-build-standalone; GitHub Actions; bash, AppleScript, launchd.

**Spec:** `docs/arquitectura.md` (secciones «Arquitectura técnica», «Despliegue y acceso desde el celular», «Instalación, actualizaciones y respaldos» y «Seguridad»).

## Global Constraints

- Python 3.13; dependencias instalables con ruedas para `x86_64-apple-darwin` y `aarch64-apple-darwin` con `MACOSX_DEPLOYMENT_TARGET=12.0`. Ninguna dependencia que necesite librerías del sistema o Homebrew.
- Interfaz compilada con `build.target: "safari17"`; sin CDN: fuentes, íconos y librerías van en el paquete.
- Configuración solo por variables de entorno: `DATA_DIR`, `BACKUP_DIR`, `PORT` (8080), `TZ` (`America/Bogota`), `NOMBRE_LOCAL` (`lya-tejidos`), `WEB_DIR`.
- Uvicorn escucha en `0.0.0.0:8080`.
- Respuestas de `/api/*`: `Cache-Control: no-store`. `index.html`: `no-cache`. `/assets/*`: `public, max-age=31536000, immutable`.
- Contraseñas con Argon2id; cookie de sesión `lya_sesion` HttpOnly, SameSite=Strict, 30 días, sin `Secure` (HTTP local). Máximo 5 intentos fallidos por minuto por IP. Código de recuperación de 8 dígitos.
- Etiquetas launchd: `co.lyatejidos.gestion` (servicio) y `co.lyatejidos.menu` (barra de menú). Plantillas en `deploy/`, con `__HOME__` a reemplazar.
- Instalación: `~/LyA/versiones/<versión>`, enlace `~/LyA/actual`, `~/LyA/datos`, `~/LyA/registros`, `~/LyA-Respaldos`. Nada pide contraseña de administrador salvo el firewall si está activo.
- Textos de la interfaz en español de Colombia, botones con verbo («Entrar», «Crear cuenta»), nunca «OK» ni «Enviar». Colores: rosa `#D9487E` (botón principal), rosa palo `#E8AFCB`, fondo `#FFF8FB`, texto `#1F1A1D`; tipografía Nunito empaquetada.
- Versión única en `backend/app/version.py` (`VERSION = "0.1.0"`); la etiqueta de release debe coincidir.
- Repositorio de releases: `LuChM27/lya-gestion`.

## Review Focus

- Ruta manipulada hacia fuera de la interfaz (`/..%2F..%2Fdatos/lya.db`, `/../app/config.py`): debe responder 404, nunca un archivo fuera de `WEB_DIR`. Prueba en la Tarea 4.
- Pulsar «Encender» con el servicio ya encendido o «Apagar» con el servicio ya apagado: no debe fallar ni mostrar error. Prueba en la Tarea 6.
- Puerto 8080 ocupado por otro programa: el servicio debe escribir «El puerto 8080 está ocupado por otro programa.» en el registro y salir con código 1, y el diagnóstico debe mostrarlo. Prueba en la Tarea 6.
- Usuario escrito con mayúsculas o espacios («Laura » al crear, «laura» al entrar): debe entrar igual. Prueba en la Tarea 3.
- Ejecutar el instalador dos veces: no duplica el ícono del Dock, no borra `~/LyA/datos` y deja el servicio encendido. Verificación en la Tarea 11.

---

## Estructura de archivos

```
backend/
  pyproject.toml, uv.lock, .python-version, alembic.ini
  app/
    __init__.py
    __main__.py        arranque: migraciones + Uvicorn (python -m app)
    version.py         VERSION
    config.py          Config desde variables de entorno
    principal.py       crear_app(config) -> FastAPI
    db.py              motor SQLite (WAL), sesiones, migrar()
    modelos.py         Usuario, Sesion
    salud.py           GET /api/salud
    auth/
      seguridad.py     hash de contraseñas y códigos, tokens
      limitador.py     5 intentos por minuto
      rutas.py         /api/auth/*
      dependencias.py  usuario_actual
    web.py             interfaz estática, fallback SPA y caché
    red.py             IP local, GET /api/acceso
    servicio.py        launchctl: estado, encender, apagar
    lanzador.py        python -m app.lanzador abrir|diagnostico
    menu.py            barra de menú (rumps, solo macOS)
  migraciones/         Alembic (env.py, versions/0001_usuarios.py)
  tests/
frontend/
  package.json, vite.config.ts, index.html, src/…
empaquetado/
  armar_paquete.py     arma el .tar.gz por plataforma
  revisar_ruedas.py    rechaza ruedas incompatibles con macOS 12
  icono.py             logo → icono.icns
  instalar.sh          instalador
  lanzador.applescript
  python.toml          versión y SHA-256 de python-build-standalone
  tests/
.github/workflows/ci.yml, release.yml
```

---

### Tarea 1: Proyecto backend, configuración y salud

**Files:**
- Create: `backend/pyproject.toml`, `backend/.python-version`, `backend/app/__init__.py`, `backend/app/version.py`, `backend/app/config.py`, `backend/app/principal.py`, `backend/app/salud.py`
- Test: `backend/tests/test_config.py`, `backend/tests/test_salud.py`, `backend/tests/conftest.py`

**Interfaces:**
- Produces:
  - `Config` (dataclass congelada): `data_dir: Path`, `backup_dir: Path`, `web_dir: Path`, `port: int`, `nombre_local: str`, `zona: str`; `Config.desde_entorno(env: Mapping[str, str] = os.environ) -> Config`.
  - `crear_app(config: Config) -> FastAPI`; guarda `config` en `app.state.config`.
  - Fixture `config_tmp(tmp_path) -> Config` y `cliente(config_tmp) -> TestClient` en `conftest.py`.

- [ ] **Paso 1: Instalar uv y crear el proyecto**

Run: `powershell -c "irm https://astral.sh/uv/install.ps1 | iex"` y luego, en `backend/`, `uv init --app --python 3.13 --no-readme`. Dependencias: `uv add fastapi uvicorn sqlalchemy alembic argon2-cffi "rumps; sys_platform == 'darwin'"` y `uv add --dev pytest httpx ruff`.
Expected: `uv run python --version` → `Python 3.13.x`.

- [ ] **Paso 2: Escribir las pruebas que fallan**

```python
def test_valores_por_defecto(tmp_path):
    c = Config.desde_entorno({"DATA_DIR": str(tmp_path)})
    assert c.port == 8080 and c.nombre_local == "lya-tejidos" and c.zona == "America/Bogota"
    assert c.data_dir == tmp_path and c.backup_dir.name == "respaldos-dev"

def test_lee_variables(tmp_path):
    c = Config.desde_entorno({"DATA_DIR": str(tmp_path), "PORT": "9090", "BACKUP_DIR": str(tmp_path / "r")})
    assert c.port == 9090 and c.backup_dir == tmp_path / "r"

def test_salud(cliente):
    r = cliente.get("/api/salud")
    assert r.status_code == 200
    assert r.json() == {"estado": "ok", "version": VERSION, "base": "ok"}
```

- [ ] **Paso 3: Implementar `Config.desde_entorno` y `crear_app`**

Valores por defecto: `DATA_DIR` = `./datos-dev`, `BACKUP_DIR` = `./respaldos-dev`, `WEB_DIR` = `<carpeta de app>/../web`, `PORT` = 8080, `NOMBRE_LOCAL` = `lya-tejidos`, `TZ` = `America/Bogota`. `desde_entorno` crea `data_dir` y `backup_dir` si no existen. `/api/salud` devuelve `"base": "ok"` fijo hasta la Tarea 2. Agregar `datos-dev/` y `respaldos-dev/` a `.gitignore`.

- [ ] **Paso 4: Correr las pruebas**

Run: `cd backend && uv run pytest -q && uv run ruff check`
Expected: todas pasan, ruff sin errores.

- [ ] **Paso 5: Commit**

```bash
git add backend .gitignore
git commit -m "Backend base: configuración por entorno y /api/salud"
```

---

### Tarea 2: Base de datos y migraciones

**Files:**
- Create: `backend/app/db.py`, `backend/app/modelos.py`, `backend/alembic.ini`, `backend/migraciones/env.py`, `backend/migraciones/versions/0001_usuarios.py`
- Modify: `backend/app/principal.py`, `backend/app/salud.py`
- Test: `backend/tests/test_db.py`, `backend/tests/test_salud.py`

**Interfaces:**
- Consumes: `Config` (Tarea 1).
- Produces:
  - `crear_motor(config: Config) -> Engine` (archivo `data_dir / "lya.db"`; en cada conexión `PRAGMA journal_mode=WAL` y `PRAGMA foreign_keys=ON`).
  - `migrar(config: Config) -> None` (Alembic `upgrade head` por código).
  - `obtener_sesion(request) -> Iterator[Session]` (dependencia FastAPI; usa `app.state.motor`).
  - `Base` declarativa; `Usuario(id, usuario: str único, hash_contrasena, hash_codigo_recuperacion, rol="duena", creado: datetime)`; `Sesion(id, token_hash: str único, usuario_id → Usuario, expira: datetime)`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

```python
def test_migrar_crea_tablas_y_wal(config_tmp):
    migrar(config_tmp)
    motor = crear_motor(config_tmp)
    with motor.connect() as c:
        assert c.exec_driver_sql("PRAGMA journal_mode").scalar() == "wal"
        assert {"usuario", "sesion"} <= set(inspect(motor).get_table_names())

def test_migrar_dos_veces_no_falla(config_tmp):
    migrar(config_tmp); migrar(config_tmp)

def test_salud_con_base_rota(cliente, monkeypatch):
    # forzar que la consulta SELECT 1 lance OperationalError
    ...
    r = cliente.get("/api/salud")
    assert r.status_code == 503 and r.json()["base"] == "error"
```

- [ ] **Paso 2: Correr y ver que fallan**

Run: `uv run pytest tests/test_db.py -q`
Expected: FAIL (`ImportError`).

- [ ] **Paso 3: Implementar `db.py`, `modelos.py` y la migración `0001_usuarios`**

`migraciones/env.py` toma la URL de `config.attributes["url"]` para que `migrar` no dependa de `alembic.ini` en tiempo de ejecución; `script_location` se resuelve relativo a `app/` para que funcione dentro del paquete. `crear_app` llama `crear_motor` y guarda `app.state.motor`. `/api/salud` hace `SELECT 1` y responde 503 con `"base": "error"` si falla. La fixture `cliente` llama `migrar` antes de crear la app.

- [ ] **Paso 4: Correr las pruebas**

Run: `uv run pytest -q`
Expected: todas pasan.

- [ ] **Paso 5: Commit**

```bash
git add backend
git commit -m "SQLite en modo WAL, modelos de usuario y sesión, migración inicial"
```

---

### Tarea 3: Autenticación

**Files:**
- Create: `backend/app/auth/__init__.py`, `seguridad.py`, `limitador.py`, `rutas.py`, `dependencias.py`
- Modify: `backend/app/principal.py`
- Test: `backend/tests/test_auth.py`, `backend/tests/test_limitador.py`

**Interfaces:**
- Consumes: `obtener_sesion`, `Usuario`, `Sesion` (Tarea 2).
- Produces:
  - `seguridad.py`: `hash_secreto(texto: str) -> str`, `verificar_secreto(hash: str, texto: str) -> bool` (Argon2id), `nuevo_codigo_recuperacion() -> str` (8 dígitos con `secrets`), `nuevo_token() -> str`, `hash_token(token: str) -> str` (SHA-256 hex).
  - `limitador.py`: `Limitador(max_intentos=5, ventana=60.0, reloj=time.monotonic)` con `bloqueado(clave: str) -> bool`, `registrar_fallo(clave: str) -> None`, `limpiar(clave: str) -> None`.
  - `dependencias.py`: `usuario_actual(request, sesion) -> Usuario` (401 si no hay cookie válida o expiró).
  - Rutas (prefijo `/api/auth`):
    - `GET /estado` → `{"configurado": bool}` (pública)
    - `POST /configurar` `{usuario, contrasena}` → 201 `{"codigo_recuperacion": "########"}` y deja la sesión iniciada
    - `POST /entrar` `{usuario, contrasena}` → 204 con cookie
    - `POST /salir` → 204, borra la sesión y la cookie
    - `GET /yo` → `{"usuario": str}`
    - `POST /recuperar` `{codigo, contrasena_nueva}` → 200 `{"codigo_recuperacion": "########"}` (el código viejo deja de servir)
  - Errores en `{"detail": "<texto>"}` con estos textos exactos:
    - 401 credenciales: «Usuario o contraseña incorrectos.»
    - 401 sin sesión: «Inicia sesión para continuar.»
    - 429: «Demasiados intentos. Espera un minuto y vuelve a intentarlo.»
    - 409 configurar repetido: «La cuenta ya está creada. Inicia sesión.»
    - 422 contraseña corta (< 8): «La contraseña debe tener al menos 8 caracteres.»
    - 400 código: «El código de recuperación no es correcto.»

- [ ] **Paso 1: Escribir las pruebas que fallan**

```python
def test_flujo_completo(cliente):
    assert cliente.get("/api/auth/estado").json() == {"configurado": False}
    r = cliente.post("/api/auth/configurar", json={"usuario": "Laura ", "contrasena": "tejidos2026"})
    assert r.status_code == 201 and re.fullmatch(r"\d{8}", r.json()["codigo_recuperacion"])
    assert cliente.get("/api/auth/yo").json() == {"usuario": "laura"}
    cliente.post("/api/auth/salir")
    assert cliente.get("/api/auth/yo").status_code == 401
    assert cliente.post("/api/auth/entrar", json={"usuario": "LAURA", "contrasena": "tejidos2026"}).status_code == 204

def test_cookie_segura(cliente):
    ...  # tras configurar: set-cookie contiene "lya_sesion=", "HttpOnly", "SameSite=strict", "Max-Age=2592000"

def test_configurar_dos_veces(cliente): ...       # segunda → 409 con el texto exacto
def test_contrasena_corta(cliente): ...           # "corta" → 422 con el texto exacto
def test_credenciales_malas(cliente): ...         # 401 con el texto exacto
def test_sexto_intento_bloqueado(cliente): ...    # 5 fallos → el 6.º (aun correcto) → 429
def test_sesion_expirada(cliente, sesion_db): ... # mover Sesion.expira al pasado → /yo 401
def test_recuperar(cliente): ...                  # código correcto cambia la contraseña; código viejo → 400; código malo cuenta para el límite

def test_limitador_se_libera_tras_la_ventana():
    t = [0.0]; lim = Limitador(reloj=lambda: t[0])
    for _ in range(5): lim.registrar_fallo("ip")
    assert lim.bloqueado("ip")
    t[0] = 61.0
    assert not lim.bloqueado("ip")
```

- [ ] **Paso 2: Correr y ver que fallan**

Run: `uv run pytest tests/test_auth.py tests/test_limitador.py -q`
Expected: FAIL.

- [ ] **Paso 3: Implementar**

El usuario se normaliza con `strip().lower()` al crear y al entrar. La clave del limitador es `request.client.host`; un intento correcto llama `limpiar`. El limitador vive en `app.state.limitador`. Los errores de validación de Pydantic para la contraseña corta se devuelven con el texto exacto (validador propio, no el mensaje por defecto).

- [ ] **Paso 4: Correr las pruebas**

Run: `uv run pytest -q`
Expected: todas pasan.

- [ ] **Paso 5: Commit**

```bash
git add backend
git commit -m "Inicio de sesión con Argon2id, cookie de 30 días, límite de intentos y código de recuperación"
```

---

### Tarea 4: Interfaz servida y reglas de caché

**Files:**
- Create: `backend/app/web.py`
- Modify: `backend/app/principal.py`
- Test: `backend/tests/test_web.py`

**Interfaces:**
- Consumes: `Config.web_dir`.
- Produces: `registrar_web(app: FastAPI, web_dir: Path) -> None` (se llama al final de `crear_app`, después de las rutas `/api`); middleware `CacheMiddleware`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

Con un `web_dir` de prueba que tenga `index.html`, `assets/index-abc123.js` y `manifest.webmanifest`, y un `secreto.txt` en el directorio padre:

```python
def test_api_no_store(cliente): assert cliente.get("/api/salud").headers["cache-control"] == "no-store"
def test_index_no_cache(cliente_web): assert cliente_web.get("/").headers["cache-control"] == "no-cache"
def test_assets_inmutables(cliente_web):
    assert cliente_web.get("/assets/index-abc123.js").headers["cache-control"] == "public, max-age=31536000, immutable"
def test_ruta_spa_devuelve_index(cliente_web):
    r = cliente_web.get("/ventas/nueva"); assert r.status_code == 200 and "<div id=\"root\">" in r.text
def test_api_inexistente_es_404_json(cliente_web): assert cliente_web.get("/api/nada").status_code == 404
@pytest.mark.parametrize("ruta", ["/..%2Fsecreto.txt", "/assets/..%2F..%2Fsecreto.txt", "/%2e%2e/secreto.txt"])
def test_no_sale_de_web_dir(cliente_web, ruta):
    r = cliente_web.get(ruta); assert "contenido secreto" not in r.text
def test_sin_web_dir_responde_mensaje(cliente):  # web_dir inexistente → "/" 503 «La interfaz no está instalada.»
```

- [ ] **Paso 2: Correr y ver que fallan**

Run: `uv run pytest tests/test_web.py -q`
Expected: FAIL.

- [ ] **Paso 3: Implementar `registrar_web`**

Ruta comodín `GET /{ruta:path}`: resolver `(web_dir / ruta).resolve()` y servir el archivo solo si está dentro de `web_dir.resolve()` (`is_relative_to`) y existe; si no, `index.html`. Rutas que empiezan por `api/` nunca caen en el fallback.

- [ ] **Paso 4: Correr las pruebas**

Run: `uv run pytest -q`
Expected: todas pasan.

- [ ] **Paso 5: Commit**

```bash
git add backend
git commit -m "Servir la interfaz con fallback SPA y reglas de caché para Safari"
```

---

### Tarea 5: Acceso desde el celular

**Files:**
- Create: `backend/app/red.py`
- Modify: `backend/app/principal.py`
- Test: `backend/tests/test_red.py`

**Interfaces:**
- Consumes: `usuario_actual` (Tarea 3), `Config.nombre_local`, `Config.port`.
- Produces: `ip_local(ejecutar=subprocess.run, sistema=sys.platform) -> str | None`; `GET /api/acceso` (requiere sesión) → `{"nombre_local": "http://lya-tejidos.local:8080", "ip": "http://192.168.1.23:8080" | null}`. `ip_local` se inyecta vía `app.state.ip_local` para las pruebas.

- [ ] **Paso 1: Escribir las pruebas que fallan**

```python
def test_ip_por_ipconfig_en_mac():
    ejecutar = falso_run({("ipconfig", "getifaddr", "en0"): "192.168.1.23\n"})
    assert ip_local(ejecutar, "darwin") == "192.168.1.23"
def test_prueba_en1_si_en0_falla(): ...       # en0 código 1, en1 "10.0.0.5" → "10.0.0.5"
def test_sin_red_devuelve_none(): ...         # ambos fallan y el socket lanza OSError → None
def test_acceso_requiere_sesion(cliente): assert cliente.get("/api/acceso").status_code == 401
def test_acceso(cliente_con_sesion): ...      # ip_local fija "192.168.1.23" → JSON esperado
```

- [ ] **Paso 2: Correr y ver que fallan**

Run: `uv run pytest tests/test_red.py -q`
Expected: FAIL.

- [ ] **Paso 3: Implementar**

En macOS: `ipconfig getifaddr en0`, luego `en1`; en otro sistema o si ambos fallan, socket UDP conectado a `192.0.2.1:80` y `getsockname()` (no envía datos). La IP se calcula en cada petición.

- [ ] **Paso 4: Correr las pruebas**

Run: `uv run pytest -q`
Expected: todas pasan.

- [ ] **Paso 5: Commit**

```bash
git add backend
git commit -m "Endpoint /api/acceso con nombre .local e IP actual para el QR"
```

---

### Tarea 6: Arranque y control del servicio

**Files:**
- Create: `backend/app/__main__.py`, `backend/app/servicio.py`, `backend/app/lanzador.py`
- Test: `backend/tests/test_servicio.py`, `backend/tests/test_lanzador.py`, `backend/tests/test_main.py`

**Interfaces:**
- Consumes: `Config`, `migrar`, `crear_app`.
- Produces:
  - `__main__.main(env=os.environ) -> int`: verifica que el puerto esté libre (si no, escribe «El puerto 8080 está ocupado por otro programa.» en stderr y devuelve 1), corre `migrar` y `uvicorn.run(crear_app(config), host="0.0.0.0", port=config.port)`.
  - `servicio.ETIQUETA = "co.lyatejidos.gestion"`.
  - `Servicio(plist: Path, uid: int, ejecutar=subprocess.run, consultar=_consultar_http, dormir=time.sleep, url_salud="http://127.0.0.1:8080/api/salud")` con:
    - `responde() -> bool` (GET con timeout de 2 s, True si 200)
    - `encender() -> None` (`launchctl bootstrap gui/<uid> <plist>`; si falla porque ya está cargado, `launchctl kickstart gui/<uid>/co.lyatejidos.gestion`)
    - `apagar() -> None` (`launchctl bootout gui/<uid>/co.lyatejidos.gestion`; si ya no estaba cargado, no es error)
    - `esperar(segundos: int = 30) -> bool`
    - `Servicio.predeterminado() -> Servicio` (plist en `~/Library/LaunchAgents`, `os.getuid()`)
  - `lanzador.abrir(servicio, abrir_url) -> int` (0 si abrió, 1 si no respondió en 30 s); `lanzador.diagnostico(servicio, registros: Path) -> str`; `python -m app.lanzador abrir|diagnostico`.
  - `abrir_url(url)`: si existe `/Applications/Google Chrome.app`, `open -na "Google Chrome" --args --app=<url>`; si no, `open <url>`. URL: `http://localhost:8080`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

```python
def test_encender_ya_encendido_usa_kickstart():
    llamadas, ejecutar = registrar_run(codigos={"bootstrap": 5})
    Servicio(Path("/p.plist"), 501, ejecutar=ejecutar).encender()
    assert llamadas[-1] == ["launchctl", "kickstart", "gui/501/co.lyatejidos.gestion"]
def test_apagar_ya_apagado_no_falla(): ...    # bootout código 3 → sin excepción
def test_esperar_hasta_que_responda(): ...    # consultar False, False, True → True con 2 llamadas a dormir
def test_esperar_se_rinde_a_los_30(): ...     # siempre False → False, 30 llamadas a dormir
def test_abrir_encendido_no_toca_launchctl(): ...
def test_abrir_apagado_enciende_y_abre(): ...
def test_abrir_falla_devuelve_1_sin_abrir(): ...
def test_diagnostico(tmp_path):
    (tmp_path / "servicio.log").write_text("\n".join(f"línea {i}" for i in range(50)) + "\nEl puerto 8080 está ocupado por otro programa.\n")
    texto = diagnostico(servicio_que_no_responde, tmp_path)
    assert "Versión: 0.1.0" in texto and "Servicio: no responde" in texto
    assert "El puerto 8080 está ocupado" in texto and "línea 29" not in texto  # solo las últimas 20 líneas
def test_main_puerto_ocupado(capsys, tmp_path):
    with socket.socket() as s:
        s.bind(("0.0.0.0", 0)); s.listen()
        assert main({"DATA_DIR": str(tmp_path), "PORT": str(s.getsockname()[1])}) == 1
    assert "está ocupado por otro programa" in capsys.readouterr().err
```

- [ ] **Paso 2: Correr y ver que fallan**

Run: `uv run pytest tests/test_servicio.py tests/test_lanzador.py tests/test_main.py -q`
Expected: FAIL.

- [ ] **Paso 3: Implementar `__main__.py`, `servicio.py` y `lanzador.py`**

El mensaje del puerto usa el número real de `config.port`. El diagnóstico incluye versión, si responde, ruta de `actual` y las últimas 20 líneas de `servicio.log`.

- [ ] **Paso 4: Correr las pruebas**

Run: `uv run pytest -q`
Expected: todas pasan.

- [ ] **Paso 5: Probar el arranque real**

Run: `uv run python -m app` y en otra terminal `curl -i http://127.0.0.1:8080/api/salud`
Expected: 200 con `"version":"0.1.0"` y `cache-control: no-store`.

- [ ] **Paso 6: Commit**

```bash
git add backend
git commit -m "Arranque con migraciones, control de launchd y lanzador con diagnóstico"
```

---

### Tarea 7: Interfaz base

**Files:**
- Create: `frontend/` (Vite React TS), `frontend/src/api.ts`, `frontend/src/paginas/Entrar.tsx`, `CrearCuenta.tsx`, `Recuperar.tsx`, `Inicio.tsx`, `frontend/src/componentes/AccesoCelular.tsx`, `frontend/src/tema.css`, `frontend/public/manifest.webmanifest`, íconos desde `assets/logo/logo-900.webp`
- Test: `frontend/src/**/*.test.tsx`

**Interfaces:**
- Consumes: `/api/auth/*` (Tarea 3), `/api/acceso` (Tarea 5).
- Produces: `api.ts` con `pedir<T>(ruta: string, opciones?: RequestInit): Promise<T>` que lanza `ErrorApi { estado: number; mensaje: string }` con el `detail` del servidor. Rutas: `/entrar`, `/crear-cuenta`, `/recuperar`, `/` (protegida).

- [ ] **Paso 1: Crear el proyecto**

Run: `npm create vite@latest frontend -- --template react-ts`, luego en `frontend/`: `npm i react-router-dom qrcode @fontsource/nunito` y `npm i -D tailwindcss @tailwindcss/vite vitest @testing-library/react @testing-library/user-event jsdom @types/qrcode`. En `vite.config.ts`: `build.target: "safari17"`, `build.outDir: "dist"`, proxy `/api` → `http://127.0.0.1:8080`, `test.environment: "jsdom"`. Colores de la paleta y Nunito como tokens en `tema.css`; tema claro y oscuro según el sistema.

- [ ] **Paso 2: Escribir las pruebas que fallan**

```tsx
test("sin cuenta configurada lleva a crear cuenta", ...)          // /api/auth/estado → {configurado:false} ⇒ se ve el botón «Crear cuenta»
test("crear cuenta muestra el código de recuperación una vez", ...) // muestra los 8 dígitos y el botón «Ya lo anoté»
test("error de entrada muestra el texto del servidor", ...)        // 401 ⇒ «Usuario o contraseña incorrectos.» visible y el campo conserva lo escrito
test("acceso desde el celular muestra QR y enlaces", ...)          // /api/acceso mock ⇒ <svg> del QR para nombre_local, y ambos enlaces como texto
test("sin IP muestra solo el nombre .local", ...)                  // ip:null ⇒ no aparece la línea de IP
```

- [ ] **Paso 3: Correr y ver que fallan**

Run: `cd frontend && npx vitest run`
Expected: FAIL.

- [ ] **Paso 4: Implementar las páginas**

Etiquetas visibles en todos los campos («Usuario», «Contraseña»); botones «Entrar», «Crear cuenta», «Cambiar contraseña», «Salir», «Entrar desde el celular». El QR se genera con `qrcode.toString(url, {type: "svg"})`, sin red. Inicio: encabezado «L&A» en rosa palo, mensaje «Aquí irán inventario, ventas y cuentas.» y el botón del celular. Botones de al menos 44 px; usable desde 360 px de ancho.

- [ ] **Paso 5: Correr pruebas y compilación**

Run: `npx vitest run && npm run build`
Expected: pruebas pasan; `dist/index.html` y `dist/assets/*` con huella en el nombre.

- [ ] **Paso 6: Probar de punta a punta en local**

Run: `npm run build` y `WEB_DIR=../frontend/dist uv run python -m app` (en PowerShell: `$env:WEB_DIR="../frontend/dist"`); abrir `http://localhost:8080`.
Expected: crear cuenta, salir, entrar y ver el QR funcionan.

- [ ] **Paso 7: Commit**

```bash
git add frontend
git commit -m "Interfaz base: crear cuenta, entrar, recuperar y acceso desde el celular"
```

---

### Tarea 8: Barra de menú y lanzador del Dock

**Files:**
- Create: `backend/app/menu.py`, `empaquetado/lanzador.applescript`
- Test: `backend/tests/test_menu.py`

**Interfaces:**
- Consumes: `Servicio`, `lanzador.abrir`, `lanzador.diagnostico` (Tarea 6).
- Produces:
  - `menu.estado_texto(responde: bool) -> str` → «L&A encendida» / «L&A apagada» (función pura, probada en cualquier sistema).
  - `menu.main() -> None` (solo macOS): `rumps.App("L&A", quit_button=None)`, política de activación accesoria vía `AppKit.NSApplication.sharedApplication().setActivationPolicy_(1)` para no salir en el Dock; temporizador de 10 s que actualiza el título del primer ítem; ítems «Abrir L&A», «Encender L&A», «Apagar L&A», «Copiar diagnóstico». «Apagar L&A» pide confirmación con `rumps.alert(title="¿Apagar L&A?", message="Si la apagas, el celular no podrá entrar hasta que la enciendas o reinicies la Mac.", ok="Apagar", cancel="Cancelar")`. «Copiar diagnóstico» usa `pbcopy`.
  - `lanzador.applescript`: corre `cd ~/LyA/actual && ./python/bin/python3 -m app.lanzador abrir`; si falla, `display dialog "L&A no pudo arrancar." buttons {"Copiar diagnóstico", "Reintentar"} default button "Reintentar"`; «Reintentar» repite; «Copiar diagnóstico» corre `... -m app.lanzador diagnostico | pbcopy` y muestra «Diagnóstico copiado. Pégalo en WhatsApp para Luciano.»

- [ ] **Paso 1: Escribir la prueba que falla**

```python
def test_estado_texto():
    assert estado_texto(True) == "L&A encendida"
    assert estado_texto(False) == "L&A apagada"
```

`menu.py` importa `rumps` y `AppKit` solo dentro de `main()`, para que la prueba corra en Windows y Linux.

- [ ] **Paso 2: Correr, implementar y volver a correr**

Run: `uv run pytest tests/test_menu.py -q`
Expected: primero FAIL, después PASS.

- [ ] **Paso 3: Commit**

```bash
git add backend empaquetado/lanzador.applescript
git commit -m "Barra de menú para encender y apagar, y lanzador del Dock en AppleScript"
```

La prueba de comportamiento real de ambos es manual, en la Tarea 11.

---

### Tarea 9: Empaquetado

**Files:**
- Create: `empaquetado/armar_paquete.py`, `empaquetado/revisar_ruedas.py`, `empaquetado/icono.py`, `empaquetado/python.toml`
- Test: `empaquetado/tests/test_revisar_ruedas.py`, `empaquetado/tests/test_icono.py`

**Interfaces:**
- Produces:
  - `revisar_ruedas.problemas(site_packages: Path, arquitectura: str, macos_max: tuple[int, int] = (12, 0)) -> list[str]`: lee `Tag:` de cada `*.dist-info/WHEEL`; acepta `any`, `universal2` y la arquitectura pedida (`x86_64` o `arm64`) con versión ≤ `macos_max`; cada problema es `"<paquete>: <etiqueta>"`. CLI: sale con 1 si hay problemas.
  - `icono.crear_icns(origen: Path, destino: Path) -> None` (Pillow, formato ICNS, desde 1024 px).
  - `armar_paquete.armar(plataforma: str, version: str, web_dist: Path, python_tar: Path, salida: Path) -> Path`; `plataforma` ∈ {`x86_64-apple-darwin`, `aarch64-apple-darwin`}. Contenido del tar: `python/` (con dependencias en `python/lib/python3.13/site-packages`), `app/`, `migraciones/`, `alembic.ini`, `web/`, `recursos/icono.icns`, `recursos/lanzador.applescript`, `recursos/co.lyatejidos.gestion.plist`, `recursos/co.lyatejidos.menu.plist`. Nombre: `lya-gestion-<version>-<plataforma>.tar.gz`, más `<nombre>.sha256` en formato `shasum -a 256 -c`.
  - `python.toml`: URL y SHA-256 del `cpython-3.13.*-<plataforma>-install_only_stripped.tar.gz` de python-build-standalone más reciente al momento de implementar, por plataforma.

- [ ] **Paso 1: Escribir las pruebas que fallan**

```python
@pytest.mark.parametrize("tag,ok", [
    ("py3-none-any", True),
    ("cp313-cp313-macosx_10_13_x86_64", True),
    ("cp313-cp313-macosx_10_9_universal2", True),
    ("cp313-cp313-macosx_12_0_x86_64", True),
    ("cp313-cp313-macosx_13_0_x86_64", False),
    ("cp313-cp313-macosx_11_0_arm64", False),   # para x86_64
    ("cp313-cp313-manylinux_2_17_x86_64", False),
])
def test_etiquetas(tmp_path, tag, ok): ...

def test_icns(tmp_path):
    crear_icns(RAIZ / "assets/logo/logo-900.webp", tmp_path / "i.icns")
    assert (tmp_path / "i.icns").read_bytes()[:4] == b"icns"
```

- [ ] **Paso 2: Correr y ver que fallan**

Run: `uv run --project backend --with pillow pytest empaquetado/tests -q`
Expected: FAIL.

- [ ] **Paso 3: Implementar**

`armar` exporta los requisitos con `uv export --frozen --no-dev --no-emit-project`, y los instala con `uv pip install --target <site-packages> --python-platform <plataforma> --python-version 3.13 --only-binary :all: -r <requisitos>` con `MACOSX_DEPLOYMENT_TARGET=12.0`. Verifica el SHA-256 del Python descargado contra `python.toml` y llama `problemas()` antes de comprimir; si hay problemas, falla. El logo de 900 px se escala a 1024 para el `.icns`.

- [ ] **Paso 4: Correr las pruebas y armar un paquete real**

Run: `uv run --project backend --with pillow pytest empaquetado/tests -q` y luego `python empaquetado/armar_paquete.py --plataforma x86_64-apple-darwin --version 0.1.0 --web frontend/dist --salida build/`
Expected: pruebas pasan; existen `build/lya-gestion-0.1.0-x86_64-apple-darwin.tar.gz` y su `.sha256`, y el log no reporta ruedas rechazadas.

- [ ] **Paso 5: Commit**

```bash
git add empaquetado .gitignore
git commit -m "Empaquetado con Python autónomo para macOS 12 Intel y Apple silicon"
```

(Agregar `build/` a `.gitignore`.)

---

### Tarea 10: Instalador y GitHub Actions

**Files:**
- Create: `empaquetado/instalar.sh`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`

**Interfaces:**
- Consumes: paquete y `.sha256` (Tarea 9), plantillas `deploy/*.plist`, `lanzador.applescript`.
- Produces:
  - `instalar.sh` con `VERSION="__VERSION__"` (lo reemplaza `release.yml`) y `REPO="LuChM27/lya-gestion"`. Variable opcional `LYA_PAQUETE=/ruta/al.tar.gz` para instalar sin descargar. Pasos, en orden y repetibles sin daño:
    1. `uname -m` → `x86_64-apple-darwin` o `aarch64-apple-darwin`; otra cosa → mensaje y salida 1.
    2. Descargar paquete y `.sha256` con `curl -fL`, verificar con `shasum -a 256 -c`.
    3. Extraer en `~/LyA/versiones/$VERSION` (reemplazando esa carpeta si existe) y `ln -sfn "versiones/$VERSION" ~/LyA/actual`.
    4. `mkdir -p ~/LyA/datos ~/LyA/registros ~/LyA-Respaldos` (nunca borrar `datos`).
    5. Copiar los plists con `__HOME__` → `$HOME`; para cada uno, `launchctl bootout` (ignorando error) y `launchctl bootstrap gui/$(id -u)`.
    6. `osacompile -o "<Aplicaciones>/L&A Gestión.app" recursos/lanzador.applescript`, donde `<Aplicaciones>` es `/Applications` si se puede escribir y si no `~/Applications`; copiar `icono.icns` a `Contents/Resources/applet.icns`; `touch` a la app.
    7. Agregar al Dock con `defaults write com.apple.dock persistent-apps -array-add …` y `killall Dock`, solo si `defaults read com.apple.dock persistent-apps` no contiene ya la ruta.
    8. Si `socketfilterfw --getglobalstate` dice que está activo: `sudo socketfilterfw --add` y `--unblockapp` sobre `~/LyA/versiones/$VERSION/python/bin/python3.13`.
    9. Esperar `/api/salud` hasta 30 s y `open http://localhost:8080`; si no responde, imprimir el diagnóstico y salir con 1.
  - `ci.yml` (push y PR): job `backend` (ubuntu, `uv sync`, `pytest`, `ruff check`), job `frontend` (Node 22, `npm ci`, `vitest run`, `npm run build`), job `empaquetado` (pytest de `empaquetado/tests`, `shellcheck empaquetado/instalar.sh`).
  - `release.yml` (etiquetas `v*`): falla si la etiqueta ≠ `v` + `VERSION`; compila la interfaz; arma ambos paquetes en ubuntu; prueba de humo en `macos-15-intel` (x86_64) y `macos-latest` (arm64): extraer, `DATA_DIR=$(mktemp -d) WEB_DIR=web ./python/bin/python3 -m app &`, esperar y comprobar con `curl -fsS http://127.0.0.1:8080/api/salud` que la versión coincide y que `/` trae `cache-control: no-cache`; si pasan, publica en GitHub Releases los dos paquetes, sus `.sha256` e `instalar.sh` con la versión puesta. Etiquetas `0.x` se publican como prerelease.

- [ ] **Paso 1: Escribir `instalar.sh` y pasar shellcheck**

Run: `shellcheck empaquetado/instalar.sh` (en CI, o con `scoop install shellcheck` en local)
Expected: sin advertencias.

- [ ] **Paso 2: Escribir los workflows y hacer push a una rama**

Run: `git switch -c base-ejecutable && git push -u origin base-ejecutable`, luego `gh run watch`
Expected: `ci.yml` en verde.

- [ ] **Paso 3: Publicar la prerelease 0.1.0**

Run: `git tag v0.1.0 && git push origin v0.1.0`, luego `gh run watch` y `gh release view v0.1.0`
Expected: release con `lya-gestion-0.1.0-x86_64-apple-darwin.tar.gz`, `lya-gestion-0.1.0-aarch64-apple-darwin.tar.gz`, sus `.sha256` e `instalar.sh`; las dos pruebas de humo en verde.

Si el repositorio es privado, la descarga anónima falla: en ese caso crear el repositorio público `LuChM27/lya-gestion-releases`, publicar ahí y cambiar `REPO` en `instalar.sh` (la arquitectura ya prevé esto).

- [ ] **Paso 4: Commit**

```bash
git add empaquetado/instalar.sh .github
git commit -m "Instalador para macOS y flujos de GitHub Actions para pruebas y releases"
```

---

### Tarea 11: Prueba en la Mac real

**Files:**
- Modify: `docs/arquitectura.md` (lista de verificación)

Esta tarea es manual, con la Mac de 2017 delante (en persona o por videollamada).

- [ ] **Paso 1: Instalar**

En la Terminal de la Mac: `curl -fsSL https://github.com/LuChM27/lya-gestion/releases/download/v0.1.0/instalar.sh | bash`
Expected: sin avisos de Gatekeeper; el navegador abre `http://localhost:8080`; aparece el ícono de L&A en el Dock y en la barra de menú.

- [ ] **Paso 2: Recorrer la lista**

- Crear la cuenta; anotar el código de recuperación en la guía impresa.
- Barra de menú → «Apagar L&A» → confirmar: el estado cambia a «L&A apagada» en ≤ 10 s y `http://localhost:8080` deja de responder.
- Clic en el ícono del Dock: enciende y abre en < 10 s. Con L&A encendida: abre en < 2 s.
- «Encender L&A» con el servicio ya encendido: sin error.
- Apagar y cerrar sesión de macOS, volver a entrar: L&A está encendida sola.
- iPhone en el mismo Wi-Fi: escanear el QR de «Entrar desde el celular», iniciar sesión y «Agregar a pantalla de inicio».
- Correr el instalador una segunda vez: un solo ícono en el Dock, la cuenta sigue existiendo, el servicio queda encendido.
- «Copiar diagnóstico» y pegarlo en una nota: trae versión, estado y registro.
- Monitor de Actividad: el proceso `python3.13` usa menos de 300 MB.

- [ ] **Paso 3: Marcar la lista de verificación**

En `docs/arquitectura.md`, cambiar `☐ Probar un paquete x86_64 de prueba en la Mac real…` por `☑` con la fecha y anotar cualquier diferencia encontrada.

- [ ] **Paso 4: Commit**

```bash
git add docs/arquitectura.md
git commit -m "Base 0.1.0 probada en la MacBook Air 2017"
```

---

## Planes siguientes de la Fase 1

Cada uno se escribe cuando este plan termine, partiendo de la base instalada:

1. **Inventario:** modelos, variantes, insumos con unidades y precios con historial, movimientos, mínimos.
2. **Venta rápida y comprobante:** venta en 3 toques que descuenta stock, PDF con ReportLab en `/api/pedidos/{id}/comprobante.pdf?v=<fecha>`.
3. **Clientes:** ficha, contactos, historial, botón de WhatsApp.
4. **Cuentas y gastos:** cuentas con saldo inicial, ingresos, gastos por categoría, transferencias; asistente de primera vez completo.
5. **Respaldos y actualizaciones:** respaldo diario con `VACUUM INTO`, retención, restaurar; actualizador desde la barra de menú con vuelta atrás y reautorización del firewall.
