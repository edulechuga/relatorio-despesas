from google_auth_oauthlib.flow import InstalledAppFlow
import os

# Escopos máximos de poder (Ler e escrever no Drive inteiro e em todas as Planilhas)
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]

def login():
    print("Iniciando processo de Login Real no seu Google...")
    if not os.path.exists('oauth_secrets.json'):
        print("🔴 ERRO: Arquivo oauth_secrets.json não encontrado!")
        print("Você precisa ir no Google Cloud > API & Services > Credentials")
        print("Criar um 'OAuth client ID' (Tipo: Desktop App), baixar o JSON e renomear para oauth_secrets.json e colocar nesta pasta.")
        return

    # Abre o navegador para você aceitar as permissões
    flow = InstalledAppFlow.from_client_secrets_file('oauth_secrets.json', SCOPES)
    creds = flow.run_local_server(port=0)

    # Salva o super token (que tem a sua cota de 15GB do Gmail)
    with open('token.json', 'w') as token:
        token.write(creds.to_json())
        
    print("✅ SUCESSO ABSOLUTO! O arquivo token.json foi gerado.")
    print("Agora o Python vai usar o seu próprio Gmail (e seus 15GB de espaço) para subir os recibos nativamente!")

if __name__ == '__main__':
    login()
