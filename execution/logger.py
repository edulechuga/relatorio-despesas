import logging
import os
from pathlib import Path

# Garante que o diretório .tmp exista
TMP_DIR = Path(__file__).parent.parent / '.tmp'
os.makedirs(TMP_DIR, exist_ok=True)

LOG_FILE = TMP_DIR / 'agent_execution.log'

def get_logger(name: str) -> logging.Logger:
    """Retorna um logger configurado para escrever no arquivo .tmp/agent_execution.log"""
    logger = logging.getLogger(name)
    
    # Previne adicionar múltiplos handlers se já estiver configurado
    if not logger.handlers:
        logger.setLevel(logging.DEBUG)
        
        # Formatador detalhado (Timestamp, Nível, Arquivo, Mensagem)
        formatter = logging.Formatter(
            '%(asctime)s | %(levelname)s | [%(name)s] %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        # Handler para escrever em arquivo
        file_handler = logging.FileHandler(LOG_FILE, encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(formatter)
        
        # Handler para printar também no console (Opcional, mas bom para debug interativo)
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(formatter)
        
        logger.addHandler(file_handler)
        logger.addHandler(console_handler)
        
    return logger
