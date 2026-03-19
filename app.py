import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from execution.logger import get_logger
from execution.processar_km import processar_km_payload
from execution.google_services import append_to_sheet

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
        logger.exception(f"Erro Interno no Servidor: {str(e)}")
        return jsonify({"erro": f"Erro interno: {str(e)}"}), 500

if __name__ == '__main__':
    # Apenas para teste local do Flask. Em prod, usar Gunicorn.
    app.run(host='0.0.0.0', port=5001, debug=True)
