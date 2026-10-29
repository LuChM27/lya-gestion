"""Configuración de L&A Gestión, leída solo de variables de entorno."""

import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

WEB_DIR_PREDETERMINADO = Path(__file__).resolve().parent.parent / "web"


@dataclass(frozen=True)
class Config:
    data_dir: Path
    backup_dir: Path
    web_dir: Path
    port: int = 8080
    nombre_local: str = "lya-tejidos"
    zona: str = "America/Bogota"

    @classmethod
    def desde_entorno(cls, env: Mapping[str, str] = os.environ) -> "Config":
        config = cls(
            data_dir=Path(env.get("DATA_DIR", "datos-dev")),
            backup_dir=Path(env.get("BACKUP_DIR", "respaldos-dev")),
            web_dir=Path(env.get("WEB_DIR", WEB_DIR_PREDETERMINADO)),
            port=int(env.get("PORT", "8080")),
            nombre_local=env.get("NOMBRE_LOCAL", "lya-tejidos"),
            zona=env.get("TZ", "America/Bogota"),
        )
        config.data_dir.mkdir(parents=True, exist_ok=True)
        config.backup_dir.mkdir(parents=True, exist_ok=True)
        return config
