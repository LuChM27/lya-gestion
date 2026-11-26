from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.db import crear_motor
from app.hora import hoy_bogota
from app.ventas.modelos import Transaccion
from tests.test_cuentas import EFECTIVO, saldo_de
from tests.test_ventas import NEQUI, item, vender, vitrina  # noqa: F401

DAVIPLATA = 3


def categoria(c, nombre: str) -> int:
    return next(x["id"] for x in c.get("/api/categorias").json() if x["nombre"] == nombre)


def mover(c, **datos):
    return c.post("/api/movimientos", json=datos)


def gasto(c, monto=150000, cat="Stand de feria", cuenta=EFECTIVO, **extra):
    return mover(
        c, tipo="gasto", monto=monto, cuenta_id=cuenta, categoria_id=categoria(c, cat), **extra
    )


def lista(c, **params):
    params.setdefault("mes", hoy_bogota().strftime("%Y-%m"))
    return c.get("/api/movimientos", params=params).json()


def iniciar_efectivo(c, monto=300000):
    c.put(f"/api/cuentas/{EFECTIVO}", json={"nombre": "Efectivo", "saldo_inicial": monto})


def test_registrar_gasto_baja_el_saldo(autenticado):
    iniciar_efectivo(autenticado)
    r = gasto(autenticado, nota="Feria Artesanal")
    assert r.status_code == 201
    assert saldo_de(autenticado, EFECTIVO) == 150000
    m = lista(autenticado)[0]
    assert m["signo"] == "-"
    assert m["editable"] is True
    assert m["origen"] is None
    assert m["categoria"] == "Stand de feria"
    assert m["descripcion"] == "Feria Artesanal"
    assert m["cuenta"] == "Efectivo"


def test_ingreso_retiro_y_transferencia(autenticado):
    iniciar_efectivo(autenticado)
    assert (
        mover(
            autenticado,
            tipo="ingreso",
            monto=50000,
            cuenta_id=EFECTIVO,
            categoria_id=categoria(autenticado, "Otros ingresos"),
        ).status_code
        == 201
    )
    r = mover(
        autenticado,
        tipo="retiro",
        monto=40000,
        cuenta_id=EFECTIVO,
        categoria_id=categoria(autenticado, "Publicidad"),
    )
    assert r.status_code == 201
    assert r.json()["categoria"] == "Retiro personal"
    r = mover(
        autenticado, tipo="transferencia", monto=100000, cuenta_id=EFECTIVO, cuenta_destino_id=NEQUI
    )
    assert r.status_code == 201
    assert r.json()["signo"] == "="
    assert r.json()["cuenta_destino"] == "Nequi"
    assert r.json()["descripcion"] == "Pasé a Nequi"
    assert saldo_de(autenticado, EFECTIVO) == 300000 + 50000 - 40000 - 100000
    assert saldo_de(autenticado, NEQUI) == 100000


def test_validaciones(autenticado):
    def detalle(r):
        assert r.status_code == 422, r.text
        return r.json()["detail"]

    assert gasto(autenticado, monto=0).status_code == 422
    autenticado.delete(f"/api/cuentas/{DAVIPLATA}")
    assert detalle(gasto(autenticado, cuenta=DAVIPLATA)) == "Elige una cuenta."
    assert detalle(gasto(autenticado, cat="Otros ingresos")) == "Elige una categoría."
    ventas = categoria(autenticado, "Ventas")
    assert (
        detalle(
            mover(autenticado, tipo="ingreso", monto=1, cuenta_id=EFECTIVO, categoria_id=ventas)
        )
        == "Elige una categoría."
    )
    assert (
        detalle(
            mover(
                autenticado,
                tipo="transferencia",
                monto=1,
                cuenta_id=EFECTIVO,
                cuenta_destino_id=EFECTIVO,
            )
        )
        == "Elige dos cuentas distintas."
    )
    manana = (hoy_bogota() + timedelta(days=1)).isoformat()
    assert detalle(gasto(autenticado, fecha=manana)) == "La fecha no puede ser futura."


def test_editar_y_borrar_manual(autenticado):
    iniciar_efectivo(autenticado)
    m = gasto(autenticado).json()
    r = autenticado.put(
        f"/api/movimientos/{m['id']}",
        json={
            "tipo": "gasto",
            "monto": 80000,
            "cuenta_id": EFECTIVO,
            "categoria_id": categoria(autenticado, "Publicidad"),
        },
    )
    assert r.status_code == 200
    assert r.json()["categoria"] == "Publicidad"
    assert saldo_de(autenticado, EFECTIVO) == 220000
    assert autenticado.delete(f"/api/movimientos/{m['id']}").status_code == 204
    assert saldo_de(autenticado, EFECTIVO) == 300000


def test_lo_de_una_venta_no_se_toca(autenticado, vitrina):  # noqa: F811
    venta = vender(autenticado, [item(vitrina["rosa"])]).json()
    m = lista(autenticado)[0]
    assert m["editable"] is False
    assert m["origen"] == {"tipo": "venta", "id": venta["id"], "numero": "0001"}
    assert m["signo"] == "+"
    cuerpo = {
        "tipo": "ingreso",
        "monto": 1,
        "cuenta_id": NEQUI,
        "categoria_id": categoria(autenticado, "Otros ingresos"),
    }
    for r in (
        autenticado.put(f"/api/movimientos/{m['id']}", json=cuerpo),
        autenticado.delete(f"/api/movimientos/{m['id']}"),
    ):
        assert r.status_code == 409
        assert (
            r.json()["detail"] == "Este movimiento viene de la venta N.º 0001: cámbialo desde allá."
        )


def test_filtrar_por_mes_y_cuenta(autenticado, vitrina):  # noqa: F811
    vender(autenticado, [item(vitrina["rosa"])])
    iniciar_efectivo(autenticado)
    mover(
        autenticado, tipo="transferencia", monto=1000, cuenta_id=EFECTIVO, cuenta_destino_id=NEQUI
    )
    hoy = hoy_bogota()
    mes_pasado = (hoy.replace(day=1) - timedelta(days=1)).isoformat()
    gasto(autenticado, fecha=mes_pasado)
    assert len(lista(autenticado)) == 2
    assert len(lista(autenticado, mes=mes_pasado[:7])) == 1
    nequi = lista(autenticado, cuenta_id=NEQUI)
    assert [m["categoria"] for m in nequi] == [None, "Ventas"]


def test_gasto_de_la_noche_cuenta_en_su_mes(autenticado, config_tmp):
    motor = crear_motor(config_tmp)
    with Session(motor) as s:
        s.add(
            Transaccion(
                fecha=datetime(2026, 11, 1, 1),
                tipo="egreso",
                monto=5000,
                descripcion="Taxi",
                cuenta_id=EFECTIVO,
            )
        )
        s.commit()
    motor.dispose()
    assert [m["descripcion"] for m in lista(autenticado, mes="2026-10")] == ["Taxi"]
    assert lista(autenticado, mes="2026-11") == []
