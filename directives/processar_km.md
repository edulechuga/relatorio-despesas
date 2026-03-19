# Diretriz: Registro de Quilometragem (KM)

**Objetivo:**
Processar dados de um formulário de KM rodada (ida e volta), calcular as distâncias totais, calcular o custo no valor atual de ressarcimento por km e injetar no acompanhamento de despesas gerenciais.

**Entradas:**
- payload JSON vindo de webhook ou form submission com as informações de quilometragem.

**Parâmetros de Entrada Esperados:**
1. `DATA` (Data da visita/viagem)
2. `Clientes Visitados` (Descrição do local/cliente)
3. `KM - IDA` (Número ou string conversível para número da KM ida)
4. `KM - VOLTA` (Opcional, quilometragem de retorno)

**Saída Esperada:**
Um dicionário Python construído pelas regras abaixo que mapeie diretamente para o arquivo `.csv` correspondente ou preencha a linha do Google Sheets respectivo.

## Regras de Negócio e Cálculo:

1. **KM Total**:
   A KM_TOTAL é a soma da `KM - IDA` e da `KM - VOLTA`.
   Se o form não enviar `KM - VOLTA`, use `0`.

2. **Cálculo de Reembolso**:
   O total em reais é: `TOTAL_RS = KM_TOTAL * 1.95`.

3. **Valores Constantes de Apoio**:
   Sempre que computar o KM as descrições padronizadas na tabela deverão ser:
   * **Categoria**: `"Transporte"`
   * **Descrição**: `"KM"`
   * **Itens**: `"KM"`

4. **Tratamento de Strings / Formulários**:
   Sempre trate as chaves `KM - IDA` e `KM - VOLTA` convertendo para valores tipo `float` na Camada 3 caso o formulário dispare em representação estrita de string `"100.5"`. O formato de retorno total em reais deve prever até duas casas decimais.

## Tratamento de Falhas (Execução Camada 3)
- Falta da variável `KM - IDA` obrigatória. Lançar erro `ValueError: Faturamento não possível devido à falta de quilometragem de Ida.`
