# Diretriz: Registro de Quilometragem (KM)

**Objetivo:**
Processar dados de um formulário web com informações de KM (ida e volta) ou com base em endereços de partida e destino. Calcular as distâncias totais, calcular o valor de ressarcimento por km e formatar os dados para inserção no Google Sheets (acompanhamento de despesas gerenciais).

**Entradas:**
- payload JSON vindo do frontend (formulário).

**Parâmetros de Entrada Esperados:**
1. `data` (Data da visita/viagem) - OBRIGATÓRIO
2. `clientes` (Descrição do local/cliente) - OBRIGATÓRIO
3. `km_ida` (Número ou string conversível para numérico) - OBRIGATÓRIO
4. `km_volta` (Número ou string conversível para numérico) - Opcional, padrão = 0.
5. `endereco_partida` (String literal) - Opcional.
6. `endereco_destino` (String literal) - Opcional.

**Saída Esperada:**
Um dicionário (objeto JSON formatado no Python) que represente as informações faturadas para injetar no Google Sheets.

## Regras de Negócio e Cálculo:

1. **Prioridade de KM Total / Endereço**:
   Se `endereco_partida` e `endereco_destino` estiverem preenchidos, o sistema deve acionar a API do Google Maps (ou similar) para calcular a distância e usá-la ignorando os campos de KM digitados (ou somando ida e volta usando a distância calculada pela API). 
   Se os endereços NÃO estiverem informados, utiliza-se a matemática simples: A KM_TOTAL é a soma da `km_ida` declarada e da `km_volta`.

2. **Cálculo de Reembolso**:
   O total em reais é: `TOTAL_RS = KM_TOTAL * 1.95`.

3. **Valores Constantes de Apoio**:
   Sempre que computar o KM as descrições padronizadas na tabela deverão ser:
   * **Categoria**: `"Transporte"`
   * **Descrição**: `"KM"`
   * **Itens**: `"KM"`

4. **Tratamento de Tipos de Dados**:
   Sempre converta os valores recebidos de `km_ida` e `km_volta` para `float`. Certifique-se de que os valores decimais em formato brasileiro (ex. `10,50`) sejam convertidos corretamente (`10.50`) antes da matemática. O valor de resposta `R$` final deve ser formatado com duas casas decimais ou enviado numérico de acordo com a planilha.

## Tratamento de Falhas (Camada 3)
- Retornar ou levantar exceção legível (ex: `"Erro: Data, Cliente ou KM-Ida não foram informados."`) se as credenciais obrigatórias não existirem.
- Caso o cálculo do Google Maps via endereço não ache a rota, utilize fallback de erro amigável recomendando preencher os campos numéricos.
