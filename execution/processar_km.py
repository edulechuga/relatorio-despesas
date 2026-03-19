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

def calcular_distancia_maps(origem: str, destino: str) -> float:
    """
    Função mock (stub) para integração com a API do Google Maps.
    Na versão final, insira chave de API + uso do pacote googlemaps.
    Se não achar rota, levanta exceção para obrigar uso dos campos manuais.
    """
    if OrigemVaziaOuIgual(origem, destino):
         raise ValueError("Endereços inválidos para cálculo.")
    
    # Mock para teste - Na realidade isso fará um get() na API do Maps
    # Ex: return result['routes'][0]['legs'][0]['distance']['value'] / 1000.0
    logger.info(f"Cálculo: Rota O-D mockada entre '{origem}' e '{destino}' -> 15.0 Km")
    return 15.0 # MOCK fixo de 15km
    
def OrigemVaziaOuIgual(o, d):
    return (not o or not d) or (o.strip() == d.strip())

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
    km_total = 0.0
    
    # Tentativa de uso via endereço se preenchido
    if endereco_partida and endereco_destino:
        try:
            # Pela diretriz, se calcularmos via API, ele substitui os digitados
            distancia_rota = calcular_distancia_maps(endereco_partida, endereco_destino)
            # Retorno Mock: assume que o cálculo acha a distância de IDA. Multiplicar por 2 para volta (se aplicável).
            # Para testes baseados no formulário, consideraremos o valor ida+volta ou ajustamos no front.
            km_total = distancia_rota
            logger.debug(f"Cálculo via Google Maps: {endereco_partida} -> {endereco_destino} = {km_total} Km")
            
            # Ajuste de UX: O form poderia pedir Checkbox "Considerar viagem de volta?", aqui assumimos que endereco é IDA.
            # No momento, usa a "distância" crua calculada.
        except Exception as e:
            logger.warning(f"Cálculo via Google Maps falhou: {str(e)}. Fallback para cálculo manual.")
            km_total = km_ida_num + km_volta_num
        logger.debug(f"Cálculo matemático: ida ({km_ida_num}) + volta ({km_volta_num}) = {km_total}")
    else:
        # Cálculo matemático simples
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
