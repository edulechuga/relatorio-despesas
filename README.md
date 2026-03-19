# Sistema de Agentes

Este projeto foi instanciado com base nas diretrizes do arquivo `AGENTE.md`, seguindo a arquitetura de 3 camadas para maximizar a confiabilidade e separar a lógica de decisão da execução determinística.

## Estrutura do Projeto

*   `directives/`: Diretório contendo os SOPs (Standard Operating Procedures) e instruções em formato Markdown. Operam na Camada 1 (O que fazer).
*   `execution/`: Diretório contendo os scripts em Python que realizam as chamadas de API, acesso a banco de dados e manipulação de arquivos. Operam na Camada 3 (Execução).
*   `.tmp/`: Diretório para armazenamento de arquivos intermediários durante o processamento. Esses arquivos não são versionados e podem ser apagados a qualquer momento.
*   `.env`: Arquivo de variáveis de ambiente.
*   `credentials.json` e `token.json`: Arquivos de credenciais do Google (Devem ser inseridos conforme necessidade e não são versionados).
