import { useId, useState, type ChangeEvent } from "react";
import { ErrorApi, subir } from "../api";
import { miniatura } from "../inventario";

const LADO = 1600;
// JPEG, PNG y WebP suben tal cual: el servidor los reduce y los endereza según la orientación EXIF.
const DIRECTOS = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 15 * 1024 * 1024;
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
      const form = new FormData();
      if (DIRECTOS.has(archivo.type) && archivo.size <= MAX_BYTES) {
        form.append("archivo", archivo, archivo.name);
      } else {
        // HEIC o fotos muy pesadas: el navegador la convierte a JPEG reducido.
        try {
          form.append("archivo", await reducir(archivo), "foto.jpg");
        } catch {
          setError(NO_SE_LEE);
          return;
        }
      }
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
      <label htmlFor={id} className="mb-2 block text-sm font-extrabold">
        Foto
      </label>
      {foto && <img src={miniatura(foto)} alt="Foto del producto" className="mb-2 h-24 w-24 rounded-[14px] object-cover" />}
      <input id={id} type="file" accept="image/*" onChange={alElegir} disabled={subiendo} className="block w-full text-sm file:mr-3 file:h-11 file:rounded-full file:border-[1.5px] file:border-rosa-palo file:bg-superficie file:px-5 file:font-extrabold file:text-rosa-oscuro" />
      {subiendo && <p className="mt-1 text-sm text-suave">Subiendo foto…</p>}
      {error && (
        <p role="alert" className="mt-1 text-sm font-semibold text-error">
          {error}
        </p>
      )}
    </div>
  );
}
