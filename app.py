import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from execution.logger import get_logger
from execution.processar_km import processar_km_payload
from execution.google_services import append_to_sheet

# Cria diretórios necessários
os.makedirs('_recibos_pendentes', exist_ok=True)
os.makedirs('relatorios_gerados', exist_ok=True)

# Inicializa logger
logger = get_logger("API_Server")

app = Flask(__name__)
# Permite requisições do frontend local
CORS(app)

@app.route('/api/km', methods=['POST'])
def registrar_km():
    data = request.get_json()
    if not data:
        return jsonify({"erro": "Nenhum payload recebido"}), 400
        
    try:
        resultado = processar_km_payload(data)
        logger.info(f"Despesa processada e formatada: {resultado}")
        
        # Monta a linha da planilha baseado nas colunas: ["Dia", "Cliente Visitado", "KM TOTAL", "R$"]
        linha = [
            resultado["Data"], 
            resultado["Razao Social"], 
            resultado["KM_TOTAL"], 
            resultado["Valor"]
        ]
        
        # Inserção Local no SQLite
        from execution.db_relatorio import inserir_despesa
        # Como o App não manda Categoria para o KM, vamos considerar default como PESSOAL para ir para o relatório
        inserir_despesa(origem="KM", tipo="PESSOAL", data=resultado["Data"], categoria=resultado["Categoria"], descricao=resultado["Descricao"], valor=resultado["Valor"])
        
        
        # Puxa o ID do arquivo .env
        sheet_id = os.getenv("SHEET_ID_KM")
        
        # Se for inglês, mude de "Página1" para "Sheet1" aqui ou no .env se preferir
        if sheet_id:
            append_to_sheet(sheet_id, "Página1", [linha])
        else:
            logger.warning("Google Sheets não acionado pois variável SHEET_ID_KM não está no .env.")
        
        return jsonify({
            "mensagem": "Cálculo efetuado e salvo no Google Sheets com sucesso!",
            "dados_sheets": resultado
        }), 200
        
    except ValueError as e:
        logger.error(f"Erro de Validação: {str(e)}")
        return jsonify({"erro": str(e)}), 400
    except Exception as e:
        logger.exception("Erro interno do servidor")
        return jsonify({"erro": str(e)}), 500

from execution.processar_recibos import analisar_recibo_com_gemini
from execution.google_services import upload_file_to_drive
from werkzeug.utils import secure_filename
import time

@app.route('/api/recibo', methods=['POST'])
def receber_recibo():
    logger.info("Entrou requisição POST em /api/recibo")
    
    if 'documento' not in request.files:
        return jsonify({"erro": "Nenhum documento enviado"}), 400
        
    file = request.files['documento']
    categoria = request.form.get('categoria', 'NAO_DEFINIDO').upper()
    
    if file.filename == '':
        return jsonify({"erro": "Arquivo vazio"}), 400
        
    try:
        # Lê o arquivo para a memória
        file_bytes = file.read()
        mime_type = file.mimetype
        
        # Mapeia as variáveis do .env dependendo da Categoria Escolhida
        folder_env_key = f"DRIVE_FOLDER_{categoria}"
        sheet_env_key = f"SHEET_ID_{categoria}"
        
        folder_id = os.getenv(folder_env_key)
        sheet_id = os.getenv(sheet_env_key)
        
        from execution.db_relatorio import inserir_despesa, TEMP_DIR
        import uuid
        
        # 1. Faz Upload pro Drive se o ID da pasta existir
        link_drive = "Sem Link"
        caminho_local_recibo = None
        
        if folder_id:
            segundos = int(time.time())
            nome_seguro = f"{segundos}_{secure_filename(file.filename)}"
            link_drive = upload_file_to_drive(file_bytes, nome_seguro, folder_id, mime_type)
            
            # Salva arquivo local Oculto para futura montagem do Fechamento do Mês
            caminho_local_recibo = os.path.join(TEMP_DIR, nome_seguro)
            with open(caminho_local_recibo, 'wb') as flocal:
                flocal.write(file_bytes)
        else:
            logger.warning(f"Não fiz upload pro Drive pois a variável {folder_env_key} está vazia ou falta no .env")

        # 2. IA Trabalhando na Foto
        dados_json = analisar_recibo_com_gemini(file_bytes, mime_type)
        
        # Inserção Local no SQLite
        inserir_despesa(origem="RECIBO", tipo=categoria, data=dados_json.get("data", ""), categoria=dados_json.get("categoria", ""), descricao=dados_json.get("descricao", ""), valor=dados_json.get("valor_total", 0), caminho_arquivo=caminho_local_recibo)
        
        # 3. Empurra pra Planilha respeitando as regras do JSON do processar_recibos.md
        if sheet_id:
            linha = [
                dados_json.get("data", ""),
                dados_json.get("categoria", categoria),
                dados_json.get("descricao", ""),
                dados_json.get("valor_total", ""),
                dados_json.get("itens_comprados", ""),
                dados_json.get("razao_social", ""),
                dados_json.get("local", ""),
                link_drive
            ]
            append_to_sheet(sheet_id, "Página1", [linha])
        else:
            logger.warning(f"Não registrou na Planilha pois a variável {sheet_env_key} está vazia ou falta no .env")
        
        return jsonify({
            "mensagem": "Recibo interpretado mágico de I.A",
            "dados_extraidos": dados_json,
            "link_foto": link_drive
        }), 200

    except ValueError as e:
        logger.error(f"Erro do Gemini ou Leitura: {e}")
        return jsonify({"erro": str(e)}), 400
    except Exception as e:
        logger.exception("Pane Geral Recibo Server")
        return jsonify({"erro": str(e)}), 500

from flask import send_from_directory

@app.route('/api/relatorio/pendentes', methods=['GET'])
def get_pendentes():
    from execution.db_relatorio import buscar_despesas
    tipo = request.args.get('tipo', 'PESSOAL').upper()
    try:
        dados = buscar_despesas(tipo)
        return jsonify({"dados": dados}), 200
    except Exception as e:
        logger.exception("Erro ao buscar pendentes")
        return jsonify({"erro": str(e)}), 500

@app.route('/api/relatorio/gerar', methods=['POST'])
def gerar_relatorio_fechamento():
    from execution.processar_relatorio import consolidar_geracao
    data = request.get_json()
    tipo = data.get('tipo', 'PESSOAL').upper()
    
    try:
        caminho_excel, caminho_pdf = consolidar_geracao(tipo)
        if not caminho_excel:
            return jsonify({"erro": "Nenhum dado pendente para gerar!"}), 400
            
        return jsonify({
            "mensagem": "Sucesso",
            "excel_url": f"/api/download/{os.path.basename(caminho_excel)}",
            "pdf_url": f"/api/download/{os.path.basename(caminho_pdf)}" if caminho_pdf else None
        }), 200
    except Exception as e:
        logger.exception("Erro ao fechar relatorio")
        return jsonify({"erro": str(e)}), 500

@app.route('/api/download/<filename>', methods=['GET'])
def baixar_arquivo(filename):
    from execution.processar_relatorio import OUTPUT_DIR
    return send_from_directory(OUTPUT_DIR, filename, as_attachment=True)

@app.route('/')
def index():
    return send_from_directory('web', 'index.html')

@app.route('/index.html')
def index_html():
    return send_from_directory('web', 'index.html')

@app.route('/recibos.html')
def recibos():
    return send_from_directory('web', 'recibos.html')

@app.route('/relatorio.html')
def relatorio():
    return send_from_directory('web', 'relatorio.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('web', filename)

if __name__ == '__main__':
    # Apenas para teste local do Flask. Em prod, usar Gunicorn.
    app.run(host='0.0.0.0', port=5001, debug=True)
