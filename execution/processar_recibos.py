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
    
    # Usando o exato modelo gratuito e turbo de 2.0 que você pediu!
    model = genai.GenerativeModel('gemini-2.0-flash-001')
    
    # Prompt de engenharia guiando as chaves que precisamos para o Sheets
    prompt = """
Você é um auditor financeiro especialista na extração de dados contábeis de recibos e notas fiscais.
Sua missão é olhar para a imagem/documento anexado e transcrever as informações vitais.
Retorne APENAS um texto puro no formato JSON. Não inclua Markdown, não coloque ```json. Apenas aberturas de chaves e os dados.

O formato EXATO deve ser:
{
    "Data": "DD/MM/YYYY",
    "Categoria": "Alimentação | Hospedagem | Transporte | Diversos ...",
    "Descricao": "Resumo de 5 palavras do gasto (ex: Almoço no Outback com Cliente)",
    "Valor": "Somente números e ponto (ex: 154.50)",
    "Itens": "1 Coca, 1 Prato Executivo, 1 Cafe",
    "Razao_Social": "Nome do Restaurante / Estabelecimento",
    "CNPJ": "Se tiver CNPJ presente, coloque aqui"
}

REGRAS RÍGIDAS:
1. Valor FINAL total gasto. Nunca pode ter o caractere R$, apenas de valor decimal com PONTO para separar centavos.
2. A Data deve ser formatada estritamente como Dia/Mês/Ano. Se não houver data, estipule a data de hoje.
3. Não insira mais NENHUM campo e nenhuma quebra de linha extra. A resposta final deve dar .loads() transparente em Python.
"""
    
    logger.info("Enviando blob visual para o Gemini 2.0 Flash...")
    
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
