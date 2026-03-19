from .logger import get_logger

logger = get_logger(__name__)

# Valor fixo do reembolso por KM estipulado na diretriz
VALOR_POR_KM = 1.95

def converter_para_float(valor):
    """Converte strings com vírgula (R$ brasileiro) para float e lida com vazios."""
    if not valor:
        return 0.0
    if isinstance(valor, str):
        valor = valor.replace(',', '.')
    try:
        return float(valor)
    except ValueError:
        return 0.0



def processar_km_payload(payload: dict) -> dict:
    """
    Processa um dicionário (payload) com campos de KM de acordo com a Layer 1 (processar_km.md).
    Retorna o dicionário pronto para injetar na planilha do Google Sheets.
    """
    
    data = payload.get('data')
    clientes = payload.get('clientes')
    km_ida_raw = payload.get('km_ida')
    km_volta_raw = payload.get('km_volta', 0)
    endereco_partida = payload.get('endereco_partida')
    endereco_destino = payload.get('endereco_destino')
    
    logger.debug(f"Processando payload de KM recebido: {payload}")
    
    # Validações dos campos obrigatórios
    if not data or not clientes or km_ida_raw is None:
        logger.error("Falha na validação: campos obrigatórios ausentes.")
        raise ValueError("Validação Falhou: 'data', 'clientes' e 'km_ida' são OBRIGATÓRIOS.")
        
    km_ida_num = converter_para_float(km_ida_raw)
    km_volta_num = converter_para_float(km_volta_raw)
    
    # O front-end agora calcula a rota usando Map DirectionsService e passa a distância real em "km_ida_raw"
    # Assim, o backend só precisa confiar na matemática final de km_ida_num + km_volta_num.
    km_total = km_ida_num + km_volta_num
    logger.debug(f"Cálculo matemático: ida ({km_ida_num}) + volta ({km_volta_num}) = {km_total}")
        
    if km_total <= 0:
        logger.error(f"Erro no cálculo KM: KM Total = {km_total}")
        raise ValueError("A distância total calculada não pode ser zero ou negativa.")
        
    valor_reembolso = round(km_total * VALOR_POR_KM, 2)
    logger.info(f"Valor consolidado com sucesso. KM_TOTAL= {km_total} -> Valor= R$ {valor_reembolso}")
    
    resultado_gsheets = {
        "Data": data,
        "Categoria": "Transporte",
        "Descricao": "KM",
        "Valor": str(valor_reembolso), # Depende de como a API do gsheets espera (string ou float)
        "Itens": "KM",
        "Razao Social": clientes,
        "KM_TOTAL": str(km_total) # Campo de apoio invisível
    }
    
    return resultado_gsheets
