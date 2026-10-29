import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

/** Pantallas sin sesión, como «Inicio de sesión · Mac»: logo a la izquierda y formulario a la derecha. */
export function Tarjeta({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-fondo md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="flex flex-col items-center justify-center gap-6 bg-rosa-palo px-6 py-10 md:py-16">
        <img src="/logo.webp" alt="L&A Tejidos" className="h-32 w-32 rounded-full object-cover md:h-[22rem] md:w-[22rem]" />
        <p className="max-w-64 text-center font-semibold text-tinta md:text-lg">Bolsos y accesorios hechos a mano, con todo en orden.</p>
      </section>
      <main className="flex items-start justify-center px-6 py-10 md:items-center">
        <div className="w-full max-w-sm">
          <h1 className="font-titulo text-[30px] leading-tight font-semibold md:text-[38px]">{titulo}</h1>
          {subtitulo && <p className="mt-1 mb-6 text-suave">{subtitulo}</p>}
          {!subtitulo && <div className="mb-6" />}
          {children}
        </div>
      </main>
    </div>
  );
}

export function Campo({ etiqueta, ...props }: { etiqueta: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">
        {etiqueta}
      </label>
      <input
        id={id}
        required
        className="h-12 w-full rounded-[14px] border border-borde bg-superficie px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-rosa"
        {...props}
      />
    </div>
  );
}

/** Contraseña con el botón de ojo del mockup para verla mientras se escribe. */
export function CampoContrasena({ etiqueta, ...props }: { etiqueta: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          id={id}
          required
          type={visible ? "text" : "password"}
          className="h-12 w-full rounded-[14px] border border-borde bg-superficie pr-12 pl-4 text-base outline-none focus-visible:border-rosa focus-visible:ring-2 focus-visible:ring-rosa/30"
          {...props}
        />
        <button
          type="button"
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-[14px] text-suave focus-visible:outline-2 focus-visible:outline-rosa"
        >
          {visible ? <EyeOff aria-hidden size={20} /> : <Eye aria-hidden size={20} />}
        </button>
      </div>
    </div>
  );
}

export function Boton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="h-12 w-full rounded-full bg-rosa px-6 font-extrabold text-white shadow-boton hover:bg-rosa-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa disabled:opacity-60"
      {...props}
    >
      {children}
    </button>
  );
}

export function BotonSecundario({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`h-11 rounded-full border border-borde bg-superficie px-5 font-bold text-rosa-oscuro hover:border-rosa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa disabled:opacity-60 ${className}`}
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
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">
        {etiqueta}
      </label>
      <select
        id={id}
        className="h-12 w-full rounded-[14px] border border-borde bg-superficie px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-rosa"
        {...props}
      >
        {opciones.map(([valor, texto]) => (
          <option key={valor} value={valor}>
            {texto}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Casilla({ etiqueta, ...props }: { etiqueta: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="mb-4 flex min-h-11 items-center gap-3 font-semibold">
      <input type="checkbox" className="h-5 w-5 accent-rosa" {...props} />
      {etiqueta}
    </label>
  );
}

export function MensajeError({ texto }: { texto: string }) {
  if (!texto) return null;
  return (
    <p role="alert" className="mb-4 text-sm font-semibold text-error">
      {texto}
    </p>
  );
}
