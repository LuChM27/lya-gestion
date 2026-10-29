import { useId, useState, type ChangeEvent } from "react";
import { ErrorApi, subir } from "../api";
import { miniatura } from "../inventario";

const LADO = 1600;
const NO_SE_LEE = "No se pudo leer esa foto. Prueba con otra o expórtala como JPEG.";

/** Dibuja la foto en un canvas: así Safari convierte HEIC a JPEG y la foto sube liviana. */
async function reducir(archivo: File): Promise<Blob> {
  const imagen = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  const contexto = lienzo.getContext("2d");
  if (!contexto) throw new Error("sin canvas");
  contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  imagen.close();
  return new Promise((listo, falla) =>
    lienzo.toBlob((blob) => (blob ? listo(blob) : falla(new Error("sin blob"))), "image/jpeg", 0.85),
  );
}

export default function SubirFoto({ foto, alSubir }: { foto: string | null; alSubir: (foto: string) => void }) {
  const id = useId();
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  async function alElegir(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError("");
    setSubiendo(true);
    try {
      let blob: Blob;
      try {
        blob = await reducir(archivo);
      } catch {
        setError(NO_SE_LEE);
        return;
      }
      const form = new FormData();
      form.append("archivo", blob, "foto.jpg");
      const r = await subir<{ foto: string }>("/api/fotos", form);
      alSubir(r.foto);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
    } finally {
      setSubiendo(false);
      e.target.value = "";
    }
  }

  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">
        Foto
      </label>
      {foto && <img src={miniatura(foto)} alt="Foto del producto" className="mb-2 h-24 w-24 rounded-lg object-cover" />}
      <input id={id} type="file" accept="image/*" onChange={alElegir} disabled={subiendo} className="block w-full text-sm file:mr-3 file:h-11 file:rounded-lg file:border file:border-borde file:bg-superficie file:px-4 file:font-semibold" />
      {subiendo && <p className="mt-1 text-sm text-suave">Subiendo foto…</p>}
      {error && (
        <p role="alert" className="mt-1 text-sm font-semibold text-error">
          {error}
        </p>
      )}
    </div>
  );
}
