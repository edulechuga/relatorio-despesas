import os
from dotenv import load_dotenv
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
import io
from googleapiclient.http import MediaIoBaseUpload
from execution.logger import get_logger

logger = get_logger("GoogleServices")

# Carrega variáveis de ambiente (ex: SHEET_ID_KM)
load_dotenv()

# Combinamos as permissões (Escopos) para que o mesmo robô 
# escreva na Planilha e guarde a Foto na pasta certa!
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]
CREDENTIALS_FILE = 'credentials.json'

def get_google_service(name='sheets', version='v4'):
    """
    Função Universal para se logar neles (Drive ou Sheets).
    A autenticação usa sempre a mesma chave credencial.json
    """
    try:
        if not os.path.exists(CREDENTIALS_FILE):
            logger.error(f"Arquivo de credenciais não encontrado: {CREDENTIALS_FILE}")
            raise FileNotFoundError(f"Coloque o arquivo {CREDENTIALS_FILE} na raiz do projeto.")
            
        creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=SCOPES)
        service = build(name, version, credentials=creds)
        return service
    except Exception as e:
        logger.exception(f"Erro ao inicializar o serviço Google {name} v{version}: {str(e)}")
        raise e

def append_to_sheet(sheet_id: str, range_name: str, values: list):
    """
    Acrescenta uma ou mais linhas (values) na planilha.
    Se range_name for "Página1", mas a aba tiver outro nome, tentaremos descobrir o nome real da primeira aba.
    """
    try:
        service = get_google_service('sheets', 'v4')
        
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

def upload_file_to_drive(file_bytes: bytes, file_name: str, folder_id: str, mime_type: str):
    """
    Eleva o nosso WebApp, atirando o PDF ou Foto na pasta correta no Google Drive!
    """
    logger.info(f"Subindo {file_name} na Pasta ID: {folder_id}...")
    try:
        drive_service = get_google_service('drive', 'v3')
        
        file_metadata = {
            'name': file_name,
            'parents': [folder_id]
        }
        
        # Precisamos embalar a memória da imagem crua pra API processar aos poucos
        media = MediaIoBaseUpload(io.BytesIO(file_bytes), mimetype=mime_type, resumable=True)
        
        # Execute o envio (fala na Web que criamos o arquivo)
        file = drive_service.files().create(
            body=file_metadata, 
            media_body=media,
            fields='id, webViewLink, webContentLink'
        ).execute()
        
        link = file.get("webViewLink")
        logger.info(f"Deu bom! Imagem salva no Drive do cliente. (Link: {link})")
        
        # (Opcional - Mas genial: a conta do robô criou e é "dona" do arquivo, ela pode dar permissão global de leitura 
        # para que o usuário ou contador clique na foto na planilha e ela abra pra todo mundo sem erro de e-mail estranho)
        # Por segurança, apenas quem tem o link gerado verá.
        try:
            drive_service.permissions().create(
                fileId=file.get('id'),
                body={'type': 'anyone', 'role': 'reader'}
            ).execute()
        except:
            pass # Se bloquearem via painel corporativo do Workspace, não tem problema o link fica travado pra ele
            
        return link
        
    except Exception as e:
        logger.exception(f"Oh não! Erro fatal ao empurrar arquivo pro GDrive: {str(e)}")
        # Não estilhaça o app, avança sem o arquivo
        return "N/D (Erro Drive)"
