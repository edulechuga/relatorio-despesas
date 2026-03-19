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
    Acrescenta uma ou mais linhas (values) na planilha.
    Se range_name for "Página1", mas a aba tiver outro nome, tentaremos descobrir o nome real da primeira aba.
    """
    try:
        service = get_sheets_service()
        
        # Estratégia Inteligente: Pega o nome real da primeira aba no Google Sheets
        # Isso evita o erro "Unable to parse range" se a aba se chamar "Sheet1", "KM" ou "Planilha1"
        try:
            sheet_metadata = service.spreadsheets().get(spreadsheetId=sheet_id).execute()
            sheets = sheet_metadata.get('sheets', [])
            if sheets:
                real_sheet_name = sheets[0].get("properties", {}).get("title", "Página1")
                # Se o nome real for encontrado, usamos ele (ex: 'KM') no lugar do fixo.
                range_name = real_sheet_name
        except Exception as meta_error:
            logger.warning(f"Não conseguiu ler os metadados da planilha: {str(meta_error)}")

        body = {
            'values': values
        }
        
        # Evita conflitos de aspas no nome da aba se ela tiver espaços
        safe_range = f"'{range_name}'!A:D"
        
        result = service.spreadsheets().values().append(
            spreadsheetId=sheet_id,
            range=safe_range,
            valueInputOption="USER_ENTERED", # IMPORTANTE: USER_ENTERED permite que fórmulas ou R$ entrem certinho
            insertDataOption="INSERT_ROWS",
            body=body
        ).execute()
        
        logger.info(f"Dados salvos no Google Sheets! Células atualizadas: {result.get('updates').get('updatedCells')}")
        return result
        
    except Exception as e:
        logger.exception(f"Erro ao tentar escrever no Google Sheets (ID: {sheet_id}): {str(e)}")
        raise e
