---
description: Comita todas as alterações pendentes e faz push para atualizar o site
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git log:*)
---

Publique as alterações pendentes no site https://soupedrosoaressilva-dev.github.io

Estado atual do repositório:

- Arquivos modificados: !`git status --short`
- Diff das mudanças: !`git diff HEAD --stat`

Passos:

1. Se não houver nenhuma alteração pendente, avise que não há nada para publicar e pare por aqui.
2. Olhe o diff para entender o que mudou de verdade (`git diff HEAD`).
3. `git add -A` para incluir tudo, inclusive arquivos novos.
4. Comite com uma mensagem em português que descreva o que mudou, no imperativo e específica — por exemplo "Adiciona botão de reiniciar no jogo-tiro", nunca algo genérico como "atualiza arquivos". Termine a mensagem com:

   Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

5. `git push`.
6. Confirme para o usuário o que foi publicado e lembre que o site leva cerca de 1 minuto para atualizar.

Se o push falhar, mostre o erro e explique o que fazer — não tente forçar com `--force`.

Contexto extra do usuário (pode estar vazio): $ARGUMENTS
