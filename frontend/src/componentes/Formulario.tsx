import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

export function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="min-h-dvh grid place-items-center bg-rosa-palo px-4 py-10">
      <section className="w-full max-w-sm rounded-2xl border border-borde bg-superficie p-6 shadow-sm">
        <img src="/logo.webp" alt="L&A Tejidos" className="mx-auto mb-4 h-28 w-28 rounded-full object-cover" />
        <h1 className="mb-6 text-center text-xl font-bold">{titulo}</h1>
        {children}
      </section>
    </main>
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
