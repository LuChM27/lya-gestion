from app.menu import estado_texto


def test_estado_texto():
    assert estado_texto(True) == "L&A encendida"
    assert estado_texto(False) == "L&A apagada"
