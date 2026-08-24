# Inventário LGPD

Sistema web para substituir as cópias da aba `3.0 Templete` da planilha por formulários individuais, com login e privacidade no banco de dados.

## Executar localmente

1. Crie um projeto no [Supabase](https://supabase.com), abra o **SQL Editor** e execute [schema.sql](supabase/schema.sql).
2. Copie `.env.example` para `.env` e informe a URL e a chave **anon pública** do projeto. Nunca coloque `service_role` no front-end.
3. Instale e execute:

   ```powershell
   npm install
   npm run dev
   ```

4. Cadastre usuários em **Authentication > Users** (ou habilite o cadastro na tela posteriormente). Depois, promova manualmente o primeiro responsável com o comando comentado no fim do SQL.

## Segurança adotada

- Autenticação do Supabase e RLS no banco: usuário comum acessa somente seus próprios inventários; administrador visualiza todos.
- `form_data` guarda as respostas por inventário; o botão **Novo inventário** cria outro formulário, substituindo a duplicação de abas.
- Exportação CSV só é mostrada ao administrador.
- O verificador de riscos roda localmente, por regras de minimização, dados sensíveis, compartilhamento, retenção, hipótese legal e transferência internacional. Não envia respostas a uma IA.

## Antes de produção

- Exija MFA, configure domínio de redirecionamento e revise as políticas no painel do Supabase.
- Restrinja os administradores a um grupo pequeno e mantenha logs/auditoria.
- Faça uma avaliação formal com o encarregado/DPO; o verificador é uma triagem, não um parecer jurídico.
- Se for acrescentar IA, envie apenas metadados anonimizados e use um serviço no back-end, nunca uma chave secreta no navegador.
