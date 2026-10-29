import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { ErrorApi, pedir } from "../api";

type Acceso = { nombre_local: string; ip: string | null };

export default function AccesoCelular() {
  const [acceso, setAcceso] = useState<Acceso | null>(null);
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    pedir<Acceso>("/api/acceso")
      .then(async (a) => {
        setAcceso(a);
        // El QR se genera aquí mismo, sin internet.
        setQr(await QRCode.toString(a.nombre_local, { type: "svg", margin: 1 }));
      })
      .catch((err) => setError(err instanceof ErrorApi ? err.mensaje : String(err)));
  }, []);

  if (error) return <p role="alert" className="text-error">{error}</p>;
  if (!acceso) return null;
  return (
    <div className="text-center">
      <p className="mb-3">Con el iPhone en el mismo Wi-Fi, abre la cámara y apunta a este código.</p>
      <div className="mx-auto mb-3 w-56 rounded-lg bg-white p-2" dangerouslySetInnerHTML={{ __html: qr }} />
      <p className="font-semibold break-all">{acceso.nombre_local}</p>
      {acceso.ip && (
        <p className="mt-2 text-sm text-suave">
          Si no abre, escribe: <span className="font-semibold break-all">{acceso.ip}</span>
        </p>
      )}
      <p className="mt-3 text-sm text-suave">Luego toca Compartir → «Agregar a pantalla de inicio».</p>
    </div>
  );
}
