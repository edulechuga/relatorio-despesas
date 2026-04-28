import sqlite3
import os
from datetime import datetime
from execution.logger import get_logger

logger = get_logger("DB_Relatorio")

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'dados_pendentes.db')
TEMP_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), '_recibos_pendentes')

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

def buscar_despesas_agrupadas(tipo, groupby):
    """
    Busca despesas agrupadas por categoria e/ou descrição com totais, quantidades e médias

    Args:
        tipo (str): Tipo de despesa (PESSOAL, CAJU, VIAGEM)
        groupby (str): Campos para agrupar ('categoria', 'descricao', or 'categoria,descricao')

    Returns:
        list: Lista de dicionários com os dados agrupados
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Determine which columns to select and group by based on groupby parameter
    if groupby == 'categoria':
        select_clause = '''
            categoria,
            SUM(valor) as total,
            COUNT(*) as quantidade,
            AVG(valor) as media
        '''
        group_clause = 'categoria'
        order_clause = 'total DESC'
    elif groupby == 'descricao':
        select_clause = '''
            descricao,
            SUM(valor) as total,
            COUNT(*) as quantidade,
            AVG(valor) as media
        '''
        group_clause = 'descricao'
        order_clause = 'total DESC'
    else:  # categoria,descricao (default)
        select_clause = '''
            data,
            categoria,
            descricao,
            SUM(valor) as total,
            COUNT(*) as quantidade,
            AVG(valor) as media
        '''
        group_clause = 'data, categoria, descricao'
        order_clause = 'data DESC, total DESC'

    query = f'''
        SELECT {select_clause}
        FROM despesas
        WHERE tipo = ?
        GROUP BY {group_clause}
        ORDER BY {order_clause}
    '''

    cursor.execute(query, (tipo.upper(),))
    rows = cursor.fetchall()
    conn.close()

    resultados = []
    for r in rows:
        if groupby == 'categoria':
            resultados.append({
                'categoria': r[0],
                'total': r[1],
                'quantidade': r[2],
                'media': r[3]
            })
        elif groupby == 'descricao':
            resultados.append({
                'descricao': r[0],
                'total': r[1],
                'quantidade': r[2],
                'media': r[3]
            })
        else:  # categoria,descricao
            resultados.append({
                'data': r[0],
                'categoria': r[1],
                'descricao': r[2],
                'total': r[3],
                'quantidade': r[4],
                'media': r[5]
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
