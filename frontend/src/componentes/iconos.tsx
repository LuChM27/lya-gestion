// Íconos copiados tal cual de docs/mockups/fuentes/*.html (viewBox 24, trazo redondeado).
import type { ReactNode, SVGProps } from "react";

type Props = { tamano?: number; trazo?: number } & Omit<SVGProps<SVGSVGElement>, "children">;

function icono(contenido: ReactNode, trazoPorDefecto = 1.8) {
  return function Icono({ tamano = 20, trazo = trazoPorDefecto, ...props }: Props) {
    return (
      <svg aria-hidden="true" width={tamano} height={tamano} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={trazo} strokeLinecap="round" strokeLinejoin="round" {...props}>
        {contenido}
      </svg>
    );
  };
}

export const IconoInicio = icono(
  <>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20h14V9.5" />
  </>,
);
export const IconoVentas = icono(
  <>
    <path d="M6 7h12l1 13H5z" />
    <path d="M9 7a3 3 0 0 1 6 0" />
  </>,
);
export const IconoPedidos = icono(
  <>
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <path d="M9 4h6v3H9zM9 12h6M9 16h4" />
  </>,
);
export const IconoInventario = icono(
  <>
    <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
    <path d="M3 8l9 5 9-5M12 13v8" />
  </>,
);
export const IconoQr = icono(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
  </>,
);
export const IconoSalir = icono(
  <>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 17l-5-5 5-5M5 12h11" />
  </>,
);
export const IconoMas = icono(
  <>
    <circle cx="5" cy="12" r="1.2" />
    <circle cx="12" cy="12" r="1.2" />
    <circle cx="19" cy="12" r="1.2" />
  </>,
);
export const IconoSumar = icono(<path d="M12 5v14M5 12h14" />, 2.4);
export const IconoVolver = icono(<path d="m15 6-6 6 6 6" />, 2);
export const IconoSiguiente = icono(<path d="m9 6 6 6-6 6" />, 2);
export const IconoListo = icono(<path d="m5 12 5 5 9-10" />, 3);
export const IconoPersona = icono(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </>,
  2,
);
export const IconoBuscar = icono(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </>,
  2,
);
export const IconoOjo = icono(
  <>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);
export const IconoOjoTachado = icono(
  <>
    <path d="M2 12s3.5-7 10-7c2 0 3.7.6 5.1 1.5M22 12s-3.5 7-10 7c-2 0-3.7-.6-5.1-1.5" />
    <path d="M4 4l16 16" />
  </>,
);
/** El bolso de las tarjetas de producto sin foto. */
export const IconoBolso = icono(
  <>
    <path d="M7 9h10l1.5 11h-13z" />
    <path d="M9 9V7a3 3 0 0 1 6 0v2" />
  </>,
  1.4,
);
// Clientes, WhatsApp, editar y cerrar: docs/mockups/fuentes/clientes-mac.html y cuentas-celular.html.
export const IconoClientes = icono(
  <>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" />
  </>,
);
export const IconoWhatsapp = icono(
  <>
    <path d="M4 20l1.4-4.2A8 8 0 1 1 8.4 19z" />
    <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .8a4 4 0 0 1-2.1-2.1l.8-1-1-2z" />
  </>,
  2,
);
export const IconoEditar = icono(
  <>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="m13.5 6.5 4 4" />
  </>,
);
export const IconoCerrar = icono(<path d="M6 6l12 12M18 6 6 18" />, 2);
// Mis cuentas y Transferir: docs/mockups/fuentes/cuentas-mac.html.
export const IconoCuentas = icono(
  <>
    <rect x="3" y="6" width="18" height="14" rx="3" />
    <path d="M3 10h18M16 15h2" />
  </>,
);
export const IconoTransferir = icono(<path d="M7 7h13l-4-4M17 17H4l4 4" />);
export const IconoAjustes = icono(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
  </>,
);
