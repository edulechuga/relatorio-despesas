from google_auth_oauthlib.flow import InstalledAppFlow
import os
import json

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]

def get_oauth_config():
    client_id = os.getenv('GOOGLE_CLIENT_ID')
    client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
    
    if not client_id or not client_secret:
        return None
    
    return {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "redirect_uris": ["http://localhost"]
        }
    }

def login():
    print("Iniciando processo de Login Real no seu Google...")
    
    oauth_config = get_oauth_config()
    if not oauth_config:
        print("🔴 ERRO: Variáveis GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET não configuradas no .env!")
        print("Edite o arquivo .env e preencha as variáveis do Google OAuth.")
        return

    flow = InstalledAppFlow.from_client_config(oauth_config, SCOPES)
    creds = flow.run_local_server(port=0)

    with open('token.json', 'w') as token:
        token.write(creds.to_json())
        
    print("✅ SUCESSO ABSOLUTO! O arquivo token.json foi gerado.")
    print("Agora o Python vai usar o seu próprio Gmail (e seus 15GB de espaço) para subir os recibos nativamente!")

if __name__ == '__main__':
    login()
