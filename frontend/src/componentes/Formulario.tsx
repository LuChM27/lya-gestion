import { useId, type InputHTMLAttributes, type ReactNode } from "react";

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
        className="h-11 w-full rounded-lg border border-borde bg-fondo px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-rosa"
        {...props}
      />
    </div>
  );
}

export function Boton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="h-11 w-full rounded-lg bg-rosa px-4 font-bold text-white hover:bg-rosa-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa disabled:opacity-60"
      {...props}
    >
      {children}
    </button>
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
