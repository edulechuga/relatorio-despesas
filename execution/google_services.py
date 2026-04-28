import os
import json
from dotenv import load_dotenv
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
import io
from googleapiclient.http import MediaIoBaseUpload
from execution.logger import get_logger

logger = get_logger("GoogleServices")

load_dotenv()

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]

from google.oauth2.credentials import Credentials as OAuthCredentials

def get_google_service(name='sheets', version='v4'):
    try:
        if os.path.exists('token.json'):
            logger.info("Usando credencial OAuth (token.json)")
            creds = OAuthCredentials.from_authorized_user_file('token.json', SCOPES)
            
            if creds and creds.expired and creds.refresh_token:
                from google.auth.transport.requests import Request
                creds.refresh(Request())
                with open('token.json', 'w') as token:
                    token.write(creds.to_json())
                    
            return build(name, version, credentials=creds)

        service_account_json = os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON')
        if service_account_json:
            logger.info("Usando credencial Service Account via variável de ambiente")
            creds_dict = json.loads(service_account_json)
            creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
            return build(name, version, credentials=creds)
            
        if os.path.exists('credentials.json'):
            logger.info("Usando credencial Service Account via arquivo")
            creds = Credentials.from_service_account_file('credentials.json', scopes=SCOPES)
            return build(name, version, credentials=creds)
            
        logger.error("Nenhuma credencial Google encontrada!")
        raise FileNotFoundError("Configure GOOGLE_SERVICE_ACCOUNT_JSON no .env ou coloque credentials.json na raiz.")
        
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
        real_sheet_name = range_name
        import time
        for attempt in range(3):
            try:
                sheet_metadata = service.spreadsheets().get(spreadsheetId=sheet_id).execute()
                sheets = sheet_metadata.get('sheets', [])
                if sheets:
                    real_sheet_name = sheets[0].get("properties", {}).get("title", "Página1")
                    range_name = real_sheet_name
                break
            except Exception as meta_error:
                if "503" in str(meta_error) and attempt < 2:
                    time.sleep(1)
                    continue
                logger.warning(f"Não conseguiu ler os metadados da planilha: {str(meta_error)}")
                break

        body = {
            'values': values
        }
        
        # Evita conflitos de aspas no nome da aba se ela tiver espaços, e usa A:Z para suportar mais de 4 colunas
        safe_range = f"'{range_name}'!A:Z"
        
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
