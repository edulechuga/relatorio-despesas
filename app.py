import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from execution.logger import get_logger
from execution.processar_km import processar_km_payload
from execution.google_services import append_to_sheet

def validate_env_var(var_name, var_value=None):
    """Validate that an environment variable is set and not empty."""
    if var_value is None:
        var_value = os.getenv(var_name)
    if not var_value:
        logger.error(f"Environment variable {var_name} is not set or is empty")
        raise ValueError(f"Required environment variable {var_name} is not configured")
    return var_value

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
        
        # Inserção Local no SQLite para o Relatório Mensal
        from execution.db_relatorio import inserir_despesa
        inserir_despesa(origem="KM", tipo="PESSOAL", data=resultado["Data"], 
            categoria="Transporte", descricao=f"KM - {resultado['Razao Social']}", 
            valor=resultado["Valor"])
        
        
        # Puxa o ID do arquivo .env
        try:
            sheet_id = validate_env_var("SHEET_ID_KM")

            # Se for inglês, mude de "Página1" para "Sheet1" aqui ou no .env se preferir
            append_to_sheet(sheet_id, "Página1", [linha])
        except ValueError as e:
            logger.warning(f"Google Sheets KM não acionado: {str(e)}")

        # Salvar também na planilha Despesas Pessoal
        try:
            sheet_id_pessoal = validate_env_var("SHEET_ID_PESSOAL")
            linha_pessoal = [
                data.get('data'),  # DATA
                "Transporte",  # CATEGORIA
                "KM",  # DESCRIÇÃO
                resultado["Valor"],  # VALOR
                "KM - " + data.get('clientes')  # ITENS
            ]
            append_to_sheet(sheet_id_pessoal, "Página1", [linha_pessoal])
        except ValueError as e:
            logger.warning(f"Planilha Pessoal não acionada: {str(e)}")
        
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

    # Check if this is just for extraction (preview mode)
    extrair_apenas = request.args.get('extrair_apenas', 'false').lower() == 'true'
    # Check if this is a confirmation with reviewed data
    confirmar = request.form.get('confirmar', 'false').lower() == 'true'

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

        # If just extracting data for preview, don't save anything
        if extrair_apenas and not confirmar:
            dados_json = analisar_recibo_com_gemini(file_bytes, mime_type)
            return jsonify({
                "mensagem": "Dados extraídos para revisão",
                "dados_extraidos": dados_json
            }), 200

        # If confirming with reviewed data
        if confirmar:
            # Get reviewed data from form
            dados_revisados_json = request.form.get('dados_revisados')
            if not dados_revisados_json:
                return jsonify({"erro": "Dados revisados não fornecidos"}), 400

            import json
            try:
                dados_json = json.loads(dados_revisados_json)
            except json.JSONDecodeError:
                return jsonify({"erro": "Formato de dados revisados inválido"}), 400

            # Validate required fields in the reviewed data
            required_fields = ["data", "categoria", "descricao", "valor_total", "itens_comprados", "razao_social", "local"]
            missing_fields = [field for field in required_fields if not dados_json.get(field)]
            if missing_fields:
                return jsonify({"erro": f"Campos obrigatórios ausentes: {', '.join(missing_fields)}"}), 400

            # When confirming, we use the reviewed data directly and skip Gemini processing
            # The file_bytes and mime_type were already captured at the beginning of the function

        else:
            # Normal flow - extract and save immediately
            dados_json = analisar_recibo_com_gemini(file_bytes, mime_type)

        # 1. Faz Upload pro Drive se o ID da pasta existir
        link_drive = "Sem Link"
        caminho_local_recibo = None

        try:
            validated_folder_id = validate_env_var(folder_env_key)
            segundos = int(time.time())
            nome_seguro = f"{segundos}_{secure_filename(file.filename)}"
            link_drive = upload_file_to_drive(file_bytes, nome_seguro, validated_folder_id, mime_type)

            # Salva arquivo local Oculto para futura montagem do Fechamento do Mês
            caminho_local_recibo = os.path.join(TEMP_DIR, nome_seguro)
            with open(caminho_local_recibo, 'wb') as flocal:
                flocal.write(file_bytes)
        except ValueError as e:
            logger.warning(f"Não fiz upload pro Drive: {str(e)}")

        # 2. IA Trabalhando na Foto (already done above if not confirming)
        # If confirming, dados_json comes from the reviewed data (processed earlier)

        # Inserção Local no SQLite
        inserir_despesa(origem="RECIBO", tipo=categoria, data=dados_json.get("data", ""), categoria=dados_json.get("categoria", ""), descricao=dados_json.get("descricao", ""), valor=dados_json.get("valor_total", 0), caminho_arquivo=caminho_local_recibo)

        # 3. Empurra pra Planilha respeitando as regras do JSON do processar_recibos.md
        try:
            validated_sheet_id = validate_env_var(sheet_env_key)
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
            append_to_sheet(validated_sheet_id, "Página1", [linha])
        except ValueError as e:
            logger.warning(f"Não registrou na Planilha: {str(e)}")

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

@app.route('/api/relatorio/breakdown', methods=['GET'])
def get_breakdown():
    from execution.db_relatorio import buscar_despesas_agrupadas
    tipo = request.args.get('tipo', 'PESSOAL').upper()
    groupby = request.args.get('groupby', 'categoria,descricao')

    # Validate tipo
    if tipo not in ['PESSOAL', 'CAJU', 'VIAGEM']:
        return jsonify({"erro": "Tipo inválido"}), 400

    # Validate groupby
    allowed_groupby = ['categoria', 'descricao', 'categoria,descricao']
    if groupby not in allowed_groupby:
        return jsonify({"erro": "Agrupamento inválido"}), 400

    try:
        dados = buscar_despesas_agrupadas(tipo, groupby)
        return jsonify({"dados": dados}), 200
    except Exception as e:
        logger.exception("Erro ao buscar breakdown")
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
    app.run(host='0.0.0.0', port=5050, debug=True)
