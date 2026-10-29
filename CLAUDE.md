# L&A Gestión

- Especificación: `docs/arquitectura.md`. Planes: `docs/superpowers/plans/`.
- **Diseño:** toda pantalla de `frontend/` copia los mockups de `docs/mockups/mockups.html`. Antes de crear, cambiar, planear o revisar interfaz, carga la skill `diseno-lya` (`.claude/skills/diseno-lya/SKILL.md`). Ahí están los valores y la forma de abrir los mockups.
- Backend: `cd backend && uv run pytest -q && uv run ruff check .`. Interfaz: `cd frontend && npx vitest run && npx tsc -b && npm run lint && npm run build`.
- Textos de la app en español de Colombia; montos `$ 125.000` y fechas DD/MM/AAAA en hora de Bogotá.
