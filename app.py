import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from execution.logger import get_logger
from execution.processar_km import processar_km_payload

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
        
    logger.info(f"Recebendo requisição POST no /api/km: {data.get('clientes', 'Desconhecido')}")
    
    try:
        resultado = processar_km_payload(data)
        logger.info(f"Despesa processada e formatada: {resultado}")
        
        # FUTURO: Aqui chamaremos Google Sheets Api p/ salvar
        
        return jsonify({
            "mensagem": "Cálculo de KM recebido e validado com sucesso!",
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
