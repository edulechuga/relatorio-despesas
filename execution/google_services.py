import os
from dotenv import load_dotenv
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from .logger import get_logger

logger = get_logger(__name__)

# Carrega variáveis de ambiente (ex: SHEET_ID_KM)
load_dotenv()

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
CREDENTIALS_FILE = 'credentials.json'

def get_sheets_service():
    """Inicializa e retorna o serviço da API do Google Sheets autorizado."""
    if not os.path.exists(CREDENTIALS_FILE):
        logger.error(f"Arquivo de credenciais não encontrado: {CREDENTIALS_FILE}")
        raise FileNotFoundError(f"Coloque o arquivo {CREDENTIALS_FILE} na raiz do projeto.")
        
    creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=SCOPES)
    service = build('sheets', 'v4', credentials=creds)
    return service

def append_to_sheet(sheet_id: str, range_name: str, values: list):
    """
    Acrescenta uma ou mais linhas (values) na planilha especificada.
    :param sheet_id: ID extraído da URL do Google Sheets.
    :param range_name: O nome da aba (ex: 'Sheet1' ou 'Página1').
    :param values: Lista de Listas contendo os dados. Ex: [["Dado1", "Dado2"]]
    """
    try:
        service = get_sheets_service()
        body = {
            'values': values
        }
        
        result = service.spreadsheets().values().append(
            spreadsheetId=sheet_id,
            range=range_name,
            valueInputOption="USER_ENTERED", # IMPORTANTE: USER_ENTERED permite que fórmulas ou R$ entrem certinho
            insertDataOption="INSERT_ROWS",
            body=body
        ).execute()
        
        logger.info(f"Dados salvos no Google Sheets! Células atualizadas: {result.get('updates').get('updatedCells')}")
        return result
        
    except Exception as e:
        logger.exception(f"Erro ao tentar escrever no Google Sheets (ID: {sheet_id}): {str(e)}")
        raise e
