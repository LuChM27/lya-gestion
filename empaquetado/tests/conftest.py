import sys
from pathlib import Path

# Los scripts de empaquetado no son un paquete; se importan desde su carpeta.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
