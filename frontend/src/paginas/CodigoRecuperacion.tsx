import { Boton } from "../componentes/Formulario";

export default function CodigoRecuperacion({ codigo, alContinuar }: { codigo: string; alContinuar: () => void }) {
  return (
    <div className="text-center">
      <p className="mb-3">Anota este código en la guía impresa. Sirve para cambiar la contraseña si la olvidas, y solo se muestra esta vez.</p>
      <p className="mb-6 rounded-2xl bg-rosa-claro py-3 font-mono text-3xl font-bold tracking-widest">{codigo}</p>
      <Boton onClick={alContinuar}>Ya lo anoté</Boton>
    </div>
  );
}
