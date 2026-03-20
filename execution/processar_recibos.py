import google.generativeai as genai
import os
import json
from execution.logger import get_logger

logger = get_logger("IA_Recibos")

def inicializar_genai():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("Chave da API do Gemini não configurada no .env")
    genai.configure(api_key=api_key)

def analisar_recibo_com_gemini(conteudo_bytes, mime_type):
    """
    Envia a foto/pdf do recibo para a IA ler 
    e extrair um JSON super limpo com os dados.
    """
    inicializar_genai()
    
    # Usando o modelo gratuito flash atualizado da API do Google!
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    # Lê as Suas Regras do Arquivo Oficial em tempo real!
    # Assim você pode mudar a Diretriz no arquivo MD sem precisar mexer em código
    with open("directives/processar_recibos.md", "r", encoding="utf-8") as f:
        prompt_diretriz = f.read()
        
    # Adiciono apenas uma trava extra de segurança pedindo pra IA ser fiel à sua diretriz
    prompt = f"LEIA E OBEDEÇA CEGAMENTE A DIRETRIZ ABAIXO:\n\n{prompt_diretriz}\n\nLembrete: Retorne apenas o JSON limpo, sem markdown em volta."
    
    logger.info("Enviando imagem + Diretriz Oficial (MD) para o Gemini 2.0 Flash...")
    
    try:
        # A API mais nova do Gemini suporta blobs literais inline!
        response = model.generate_content([
            prompt,
            {
                "mime_type": mime_type,
                "data": conteudo_bytes
            }
        ])
        
        texto_sujo = response.text.strip()
        logger.debug(f"Retorno bruto AI: {texto_sujo}")
        
        # Faxina anti-markdown
        if texto_sujo.startswith('```json'):
            texto_sujo = texto_sujo.replace('```json', '', 1)
        if texto_sujo.endswith('```'):
            texto_sujo = texto_sujo[:-3]
        if texto_sujo.startswith('```'):
            texto_sujo = texto_sujo.replace('```', '', 1)
            
        dados = json.loads(texto_sujo.strip())
        logger.info(f"Dados parseados com Sucesso: {dados}")
        
        return dados
        
    except Exception as e:
        logger.exception("Falha na interpretação Visual pela IA:")
        raise ValueError(f"Não conseguimos ler a imagem com o Google AI. Tente uma foto com melhor foco. Erro técnico: {e}")
