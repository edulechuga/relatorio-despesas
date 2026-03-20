import sqlite3
import os
from datetime import datetime
from execution.logger import get_logger

logger = get_logger("DB_Relatorio")

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'dados_pendentes.db')

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS despesas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            origem TEXT NOT NULL, 
            tipo TEXT NOT NULL,
            data TEXT NOT NULL,
            categoria TEXT NOT NULL,
            descricao TEXT NOT NULL,
            valor REAL NOT NULL,
            caminho_arquivo TEXT
        )
    ''')
    conn.commit()
    conn.close()

def inserir_despesa(origem, tipo, data, categoria, descricao, valor, caminho_arquivo=None):
    try:
        if isinstance(valor, str):
            valor = float(valor.replace(',', '.'))
            
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO despesas (origem, tipo, data, categoria, descricao, valor, caminho_arquivo)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (origem, tipo.upper(), data, categoria, descricao, valor, caminho_arquivo))
        conn.commit()
        conn.close()
        logger.info(f"Despesa local salva para o Relatório: {descricao} - R$ {valor}")
    except Exception as e:
        logger.exception(f"Erro ao salvar no DB Local: {e}")

def buscar_despesas(tipo):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, origem, data, categoria, descricao, valor, caminho_arquivo 
        FROM despesas WHERE tipo = ?
    ''', (tipo.upper(),))
    rows = cursor.fetchall()
    conn.close()
    
    resultados = []
    for r in rows:
        resultados.append({
            'id': r[0],
            'origem': r[1],
            'data': r[2],
            'categoria': r[3],
            'descricao': r[4],
            'valor': r[5],
            'caminho_arquivo': r[6]
        })
    return resultados

def limpar_despesas(tipo):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM despesas WHERE tipo = ?', (tipo.upper(),))
    conn.commit()
    conn.close()
    logger.info(f"As despesas do tipo {tipo} foram esvaziadas do DB Local!")

init_db()
