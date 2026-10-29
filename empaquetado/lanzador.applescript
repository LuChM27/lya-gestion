-- Ícono del Dock de L&A Gestión. instalar.sh lo compila en la Mac con osacompile,
-- así la app no llega descargada y Gatekeeper no la bloquea.
set lanzador to "cd \"$HOME/LyA/actual\" && ./python/bin/python3 -m app.lanzador "

repeat
	try
		do shell script lanzador & "abrir"
		exit repeat
	on error
		set respuesta to button returned of (display dialog "L&A no pudo arrancar." buttons {"Copiar diagnóstico", "Reintentar"} default button "Reintentar" with icon caution)
		if respuesta is "Copiar diagnóstico" then
			do shell script lanzador & "diagnostico | pbcopy"
			display dialog "Diagnóstico copiado. Pégalo en WhatsApp para Luciano." buttons {"Cerrar"} default button "Cerrar"
			exit repeat
		end if
	end try
end repeat
