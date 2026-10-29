from app.auth.limitador import Limitador


def test_bloquea_tras_cinco_fallos():
    lim = Limitador(reloj=lambda: 0.0)
    for _ in range(4):
        lim.registrar_fallo("ip")
    assert not lim.bloqueado("ip")
    lim.registrar_fallo("ip")
    assert lim.bloqueado("ip")


def test_limitador_se_libera_tras_la_ventana():
    t = [0.0]
    lim = Limitador(reloj=lambda: t[0])
    for _ in range(5):
        lim.registrar_fallo("ip")
    assert lim.bloqueado("ip")
    t[0] = 61.0
    assert not lim.bloqueado("ip")


def test_limpiar_y_claves_separadas():
    lim = Limitador(reloj=lambda: 0.0)
    for _ in range(5):
        lim.registrar_fallo("a")
    assert not lim.bloqueado("b")
    lim.limpiar("a")
    assert not lim.bloqueado("a")
