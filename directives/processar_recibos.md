# Diretriz: Processamento de Recibos e Notas Fiscais

**Objetivo:**
Ler imagens ou PDFs de recibos e notas fiscais, extrair dados estruturados via IA (Visão), e salvar no formato JSON correto para posterior inserção no Google Sheets.

**Entradas:**
- Arquivos de imagem (PNG, JPG) ou PDF baixados do Google Drive. Os arquivos estarão disponíveis temporariamente no diretório `.tmp/`.

**Saída Esperada:**
Um objeto JSON estritamente formatado contendo os campos descritos abaixo. Nenhuma formatação Markdown extra (como ````json`) deve ser retornada pela IA (ou deve ser limpa pela Camada 3 caso a IA retorne).

## Prompt do Sistema (A ser enviado para o modelo de Visão)

Você deve agir como um expert em analisar imagens de recibos de compra e notas fiscais. A resposta **sempre** deverá ser em Português do Brasil.

Analise o recibo anexado e extraia as seguintes informações:

1. **Data**: A data da transação. A data deverá ser informada no formato estadunidense: MM/DD/AA.
2. **Categoria**: A categoria da despesa. **Obrigatoriamente** uma destas opções: `Alimentação`, `Hospedagem`, `Transporte`, `Outros`. Não gere nenhuma outra opção.
   * *Regra Especial*: Compra de alimentação gerada em um hotel -> `Alimentação`.
   * *Regra Especial*: Despesas de estacionamento -> `Transporte` (100% das vezes).
   * *Regra Especial*: Despesas de alimentação -> `Alimentação` (100% das vezes).
3. **Descrição**: Uma breve descrição do que foi comprado. **Obrigatoriamente** uma destas opções: `Alimentação`, `KM`, `Gasolina`, `Estacionamento`, `Brindes`, `Compras escritório`, `Pedágio`, `Eventos`, `Uber`. A única exceção é quando for expressamente solicitado diferente ao sistema.
4. **Valor Total**: O valor total numérico da transação (ex: 15.50).
5. **Itens Comprados**: Os itens específicos que foram comprados (descrição livre curta).
6. **Razão Social**: O nome da empresa/estabelecimento comercial que consta no recibo.
7. **Local**: O local onde a compra foi realizada, incluindo o endereço completo.

### Formato de Saída (JSON Estrito)
Forneça as informações extraídas **apenas em formato JSON válido**, sem nenhuma marcação adicional ou texto de introdução.

```json
{
  "data": "",
  "categoria": "",
  "descricao": "",
  "valor_total": "",
  "itens_comprados": "",
  "razao_social": "",
  "local": ""
}
```

### Exemplo de Resposta
```json
{"data": "07/25/2025", "categoria": "Alimentação", "descricao": "Alimentação", "valor_total": "15.50", "itens_comprados": "Rei do Mate, Pão com Manteiga", "razao_social": "MARELLAS COMERCIO DE ALIMENTOS LTDA", "local": "Avenida Professor Lineu Prestes, 2565 - Butantã, Sao Paulo - SP"}
```

## Tratamento de Falhas (Execução Camada 3)
- **Erro de Parsing**: Se a IA devolver um JSON inválido (ex: aspas soltas nos "itens_comprados"), o script de execução em Python DEVE tentar limpar as marcações Markdown (ex: regex para remover ````json\n...\n````) e tentar ler o JSON novamente usando a biblioteca `json`.
- **Validação de Categorias**: O script Python deve confirmar se a "categoria" e a "descricao" pertencem à lista estrita. Se houver falha (alucinação), a despesa deve ser registrada como "Outros" ou lançar uma exceção clara para ser verificada pelo usuário.
