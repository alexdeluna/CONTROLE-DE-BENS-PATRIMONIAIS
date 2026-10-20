# Portal de Gestão Patrimonial — base inicial

Aplicação web com HTML, CSS e JavaScript puro, preparada para GitHub Pages e Firebase Authentication/Cloud Firestore.

## O que está incluído nesta etapa

- Tela inicial de autenticação por e-mail e senha.
- Verificação de perfil `ADM` ou `GESTOR_PATRIMONIAL` na coleção `usuarios`.
- Painel com contagem de bens.
- Consulta inicial de bens com filtros por tombamento/descrição, categoria e situação.
- Leitura e validação da planilha-modelo `.xlsx`.
- Prévia da quantidade de registros e dos erros.
- Importação inicial permitida somente em base vazia e somente pelo perfil ADM.
- Regras iniciais do Firestore.
- Estrutura PWA básica.

## Antes de publicar

1. No Firebase Console, confira se o provedor **E-mail/senha** está habilitado em Authentication.
2. Publique `firestore.rules` no Firestore Rules.
3. Crie o primeiro usuário em Authentication.
4. Crie manualmente, no Firestore, um documento em `usuarios` cujo ID seja exatamente o UID desse usuário. Campos:
   - `perfil`: `ADM`
   - `ativo`: `true`
   - `nome`: nome do administrador
5. Publique os arquivos no repositório GitHub Pages.
6. Abra a aplicação por HTTPS para testar a autenticação e a importação.

**Não habilite acesso público ao Firestore.** A configuração web Firebase não é segredo; a segurança depende das regras.

## Planilha esperada

A importação exige estas abas e nomes de colunas, de acordo com o arquivo `Modelo_Dados_Gestao_Patrimonial.xlsx`:

- `Bens`
- `Categorias`
- `Responsaveis`
- `Setores`
- `LocaisFisicos`
- `Unidades`

A aba `LEIA-ME` é informativa e não é importada.

## Limitações desta etapa

- A importação inicial não faz merge nem atualização de uma base existente.
- Se uma importação falhar no meio, alguns lotes podem já ter sido gravados. Não repita a carga sem verificar as coleções no console.
- As regras são uma base inicial e devem ser testadas no Firebase Emulator antes de uso com dados reais.
- Transferência, baixa, trilha completa de auditoria, edição detalhada de cadastros e gerenciamento de usuários ainda não estão implementados nesta entrega.
- A aplicação necessita de internet para autenticação e Firestore; o service worker apenas armazena a estrutura estática básica.


## Versão 2
- Planilha v2 inclui a aba Andares. O setor referencia o local físico atual; bens referenciam setor e herdam a localização.
- Botão de limpeza destrutiva disponível para ADM após digitar APAGAR DADOS DE TESTE. Apaga cadastros principais, preservando usuários e histórico/auditoria. Usar somente na base de teste.
- A base existente não é migrada automaticamente. Não importar a planilha v2 sobre a base atual sem estratégia de migração aprovada.
\n## Etapa 4 — Transferência de bem\n- Nova tela para selecionar bem, revisar origem/destino e confirmar a transferência.\n- Ao confirmar, o setor/responsável do bem é atualizado e são gravados registros em movimentacoes e auditoria em um batch Firestore.\n- Testar regras e campos de destino no Firebase de desenvolvimento antes de usar dados reais.\n
## Etapa 5 — Baixa patrimonial\n- Tela de baixa disponível somente para ADM na interface.\n- Exige seleção do bem e motivo, permite documento/processo e observações, mostra cartão de revisão e confirmação explícita.\n- Atualiza situação para Baixado e registra baixa/auditoria no mesmo batch. Tombamento e documento do bem permanecem.\n- Requer testar as regras Firestore no ambiente de desenvolvimento antes de uso real.\n\n## Correção do painel — contagem de situação\n- Corrigida a leitura dos indicadores Ativos/Baixados: a carga inicial grava `Situacao` com S maiúsculo, enquanto a contagem anterior filtrava `situacao` minúsculo. A contagem agora aceita ambos os nomes de campo.\n
## Etapa 6 — Cadastros básicos\n- Tela ADM para listar e criar/editar categorias, unidades, andares, locais físicos, setores e responsáveis.\n- Não inclui exclusão de cadastros; isso evita romper vínculos de bens existentes.\n- Testar referências e permissões no Firestore de desenvolvimento.\n\n## Etapa 7 — Cadastro e edição de bens\n- Cadastro manual e edição de bens existentes, com tombamento único e imutável após cadastro.\n- Situação inicial Ativo; localização calculada pelo setor.\n- Auditoria registrada em cada inclusão/edição. Bens existentes não são alterados até o usuário salvar uma edição.\n- Confirmar as regras Firestore para criação/edição por perfil e criação de auditoria antes de usar.\n
## Etapa 8 — Alteração de localização por setor\n- Tela ADM para alterar a localização física do setor uma única vez.\n- Mostra origem, destino, quantidade de bens afetados e motivo em card de revisão.\n- Ao confirmar, atualiza o vínculo do setor e registra histórico/auditoria sem criar movimentações individuais para cada bem.\n- Validar regras Firestore para atualização de setores e gravação em movimentacoes/auditoria.\n