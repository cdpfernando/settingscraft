import os

from sqlmodel import SQLModel, Session, create_engine

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./cache.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def criar_tabelas() -> None:
    SQLModel.metadata.create_all(engine)


def obter_sessao():
    with Session(engine) as sessao:
        yield sessao
