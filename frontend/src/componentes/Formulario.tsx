// Formularios con los estilos de docs/mockups/fuentes/login-mac.html.
import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { IconoOjo, IconoOjoTachado } from "./iconos";

const ETIQUETA = "mb-2 block text-sm font-extrabold";
const CAMPO =
  "h-[52px] w-full rounded-2xl border-[1.5px] border-borde-campo bg-superficie px-[18px] text-base text-tinta outline-none focus:border-2 focus:border-rosa focus:shadow-[0_0_0_4px_var(--color-rosa-claro)]";

/** Pantallas sin sesión, como login-mac: logo grande a la izquierda y formulario a la derecha. */
export function Tarjeta({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-wrap bg-fondo">
      <section className="flex min-h-[260px] flex-[1_1_520px] flex-col items-center justify-center bg-rosa-login px-10 py-8 md:min-h-[420px] md:py-14">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/logo-900.webp" alt="L&A Tejidos" width={460} height={460} className="block h-auto w-[180px] max-w-full md:w-[460px]" />
          <p className="max-w-[340px] text-base leading-normal font-semibold text-rosa-texto-login md:text-lg">Bolsos y accesorios hechos a mano, con todo en orden.</p>
        </div>
      </section>
      <section className="flex flex-[1_1_440px] items-center justify-center px-8 py-10 md:py-16">
        <main className="flex w-full max-w-[400px] flex-col">
          <div className="mb-[22px] flex flex-col gap-2">
            <h1 className="font-titulo text-[32px] leading-[1.15] font-semibold md:text-[38px]">{titulo}</h1>
            {subtitulo && <p className="text-base leading-normal text-suave">{subtitulo}</p>}
          </div>
          {children}
        </main>
      </section>
    </div>
  );
}

export function Campo({ etiqueta, ...props }: { etiqueta: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="mb-[22px]">
      <label htmlFor={id} className={ETIQUETA}>
        {etiqueta}
      </label>
      <input id={id} required className={CAMPO} {...props} />
    </div>
  );
}

/** Contraseña con el botón de ojo del mockup. */
export function CampoContrasena({ etiqueta, ...props }: { etiqueta: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="mb-[22px]">
      <label htmlFor={id} className={ETIQUETA}>
        {etiqueta}
      </label>
      <div className="relative">
        <input id={id} required type={visible ? "text" : "password"} className={`${CAMPO} pr-14`} {...props} />
        <button
          type="button"
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          onClick={() => setVisible((v) => !v)}
          className="absolute top-1 right-1 flex h-11 w-11 items-center justify-center rounded-xl text-suave focus-visible:outline-2 focus-visible:outline-rosa"
        >
          {visible ? <IconoOjoTachado /> : <IconoOjo />}
        </button>
      </div>
    </div>
  );
}

/** Botón principal grande de formulario (Entrar, Guardar). */
export function Boton({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`h-14 w-full rounded-full bg-rosa px-6 text-[17px] font-extrabold text-white shadow-boton-grande hover:bg-rosa-activo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** Botón blanco con borde rosa palo, como «Ver comprobante PDF». */
export function BotonSecundario({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`h-11 rounded-full border-[1.5px] border-rosa-palo bg-superficie px-5 text-[15px] font-extrabold text-rosa-oscuro hover:border-rosa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Selector({
  etiqueta,
  opciones,
  ...props
}: { etiqueta: string; opciones: readonly (readonly [string, string])[] } & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className="mb-[22px]">
      <label htmlFor={id} className={ETIQUETA}>
        {etiqueta}
      </label>
      <select id={id} className={CAMPO} {...props}>
        {opciones.map(([valor, texto]) => (
          <option key={valor} value={valor}>
            {texto}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Casilla rosa, como «Recordarme en este equipo». */
export function Casilla({ etiqueta, ...props }: { etiqueta: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="mb-[22px] flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px] font-bold text-tinta-media">
      <input type="checkbox" className="m-0 h-5 w-5 accent-rosa" {...props} />
      {etiqueta}
    </label>
  );
}

export function MensajeError({ texto }: { texto: string }) {
  if (!texto) return null;
  return (
    <p role="alert" className="mb-4 text-sm font-bold text-error">
      {texto}
    </p>
  );
}
