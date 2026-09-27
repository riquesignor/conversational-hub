# Instruções deste projeto para o Claude Code

Notas de ambiente de desenvolvimento (Node/nvm, o pen drive exFAT em que
este projeto roda, scripts de automount, CRLF/LF) estão em
[docs/dev-environment.md](docs/dev-environment.md) — não repita esse
diagnóstico do zero, só confira se ainda bate com a realidade antes de
mexer em setup/deps.

## Autorização de edição

Você (Claude Code) pode **editar arquivos deste projeto livremente**
quando o usuário pedir, sem precisar confirmar cada edição individual.

`git commit` e `git push` só quando o usuário pedir explicitamente — o
projeto tem deploy automático na Vercel a cada push na `main` (ver
[docs/dev-environment.md](docs/dev-environment.md)). Dito isso, a
preferência confirmada do usuário é **commit + push juntos numa tacada
só** sempre que ele pedir pra "commitar" (não precisa perguntar se é só
commit ou também push — assuma os dois, a menos que ele diga o contrário
pra aquele pedido específico).

**Não adicione a linha `Co-Authored-By: Claude ...` nas mensagens de
commit deste projeto.** O usuário não quer aparecer como "riquesignor +
Claude" nos commits no GitHub. Isso vale só pra commits NOVOS — os que já
foram pushados com essa linha continuam mostrando o coautor (reescrever
isso exigiria `git rebase` + `git push --force` na `main`, uma operação
destrutiva que não deve ser feita sem pedido explícito e separado do
usuário, dado o risco pra branch de produção).
