import socket

from app.__main__ import main


def test_main_puerto_ocupado(capsys, tmp_path):
    with socket.socket() as s:
        s.bind(("0.0.0.0", 0))
        s.listen()
        puerto = s.getsockname()[1]
        codigo = main(
            {
                "DATA_DIR": str(tmp_path / "d"),
                "BACKUP_DIR": str(tmp_path / "r"),
                "PORT": str(puerto),
            }
        )
    assert codigo == 1
    assert f"El puerto {puerto} está ocupado por otro programa." in capsys.readouterr().err
