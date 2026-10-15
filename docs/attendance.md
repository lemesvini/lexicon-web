# Presença (registro de aulas) — como funciona

Estado atual, depois da migration `0028_group_classes.sql`. A presença é sempre
de uma **turma (group)**, registrada pelo professor na página do grupo
(`/groups/:groupId`) no lexicon-web.

## Modelo de dados

| Tabela | O que é |
|---|---|
| `group_classes` | Uma linha por **aula que aconteceu**: `group_id`, `lesson_id` (a lição dada, pode ser null), `class_date`, `starts_at` (pré-preenchido com `groups.starts_at`, mas editável), `recorded_by`. |
| `group_attendance` | Uma linha por **aluno por aula**: `class_id`, `group_id`, `student_id`, `present`, `excused`. Única por `(class_id, student_id)`. |
| `group_cancelled_classes` | Um dia de encontro marcado como **"sem aula"** (feriado, professor doente). PK `(group_id, class_date)`, com `note` opcional. |

Regras do schema:
- Um grupo pode ter mais de uma aula no mesmo dia, **em horários diferentes**.
  Mesmo grupo + data + horário é bloqueado (`unique nulls not distinct`). Duas
  aulas sem horário no mesmo dia também contam como conflito.
- `group_attendance.group_id` fica preso ao grupo da aula por FK composta
  `(class_id, group_id)`. Ele existe porque o RLS e as contagens por grupo leem
  essa coluna.
- Apagar uma aula apaga as presenças dela (cascade).
- Antes da 0028, data e lição ficavam em cada linha de `group_attendance`. A
  migration agrupou os registros antigos em uma aula por (grupo, data) e removeu
  `class_date` e `lesson_id` de `group_attendance`.

## As marcações

Cada aluno, em cada aula, tem um de quatro estados:

| Estado | No banco |
|---|---|
| **present** | linha com `present = true`, `excused = false` |
| **absent** | linha com `present = false`, `excused = false` |
| **excused** (falta justificada) | linha com `present = false`, `excused = true` |
| **não marcado** | **nenhuma linha** |

"Não marcado" **não** é falta. Um aluno que entrou no grupo depois não estava
ausente das aulas anteriores. Falta justificada continua sendo falta
(`present = false`), então leitores antigos a contam como ausência.

No tipo TS (`Mark` em `src/features/groups/data/group-classes.ts`):
`"present" | "absent" | "excused"`, e "não marcado" é `null`/ausência no registro.

## Como o professor registra

Na página do grupo (`group-page.tsx` + `group-register-table.tsx`):

1. Escolhe a data (e, se houver mais de uma aula no dia, qual aula ou "nova aula").
2. A lição vem **sugerida** (ver abaixo), mas pode ser trocada. O horário vem do
   grupo.
3. Clicar no aluno passa por **não marcado → present → absent → não marcado**.
   "Excused absence" e "limpar" ficam no menu da linha. Também existe "Mark all
   present".
4. Nada é gravado até clicar em **Save**. Sair com alterações pendentes pede
   confirmação (`useBlocker`).
5. O Save chama a RPC `save_group_class(p_class_id, p_group_id, p_lesson_id,
   p_class_date, p_starts_at, p_marks)`, que grava **tudo em uma transação**:
   - cria a aula (`p_class_id` null) ou atualiza a existente;
   - `p_marks` é o **registro completo**, e aluno que não vier nele perde a
     marcação dessa aula;
   - apaga um "sem aula" que exista nessa data;
   - recusa com erro amigável se já houver aula naquela data e horário.
6. Uma aula pode ser apagada (`deleteGroupClass`).

Pelo painel de detalhes do grupo (`group-details-sheet.tsx`), o professor vê a
lista de aulas e os **dias pendentes**, e pode abrir um pendente para registrar
ou marcá-lo como "sem aula".

Ex-alunos do grupo que têm marcação numa aula continuam aparecendo nela, porque
é histórico e pode ser corrigido.

## O que a presença decide

A presença é a **fonte da verdade do plano de aulas** (`class-plan.ts`):

- **Uma aula "aconteceu"** se teve **pelo menos um aluno presente**. Uma aula sem
  ninguém presente não ensinou nada.
- **Uma lição foi dada** na primeira data em que uma aula com alguém presente a
  registrou (`taughtOn`).
- **Próxima lição sugerida** (`suggestNextLesson`) é a seguinte, na sequência do
  curso, à lição da **aula mais recente que aconteceu**, e não "a primeira nunca
  dada". Assim, uma lição pulada de propósito continua pulada. Antes de qualquer
  aula, a sugestão é a primeira lição. Depois da última, não há sugestão.
  Aulas com lição fora da sequência do grupo são ignoradas para isso.
- `groups.lesson_id` (lição atual do grupo) é atualizado automaticamente para
  a próxima lição do plano quando a página abre.
- **Datas do plano** (`group_lessons.scheduled_on`) são uma projeção que
  `reflowPlan` recalcula depois de cada save. Lições dadas ficam com a data em
  que foram dadas, e as próximas vão para os próximos dias de encontro
  (`meets_on`), pulando dias já registrados ou "sem aula". Lições não dadas
  antes da próxima perdem a data. Para corrigir datas, corrige-se o registro.
- **Dias pendentes**: dias de encontro passados, a partir da primeira aula
  registrada, nos últimos 60 dias, sem aula e sem "sem aula".
- **Lições perdidas** (`missedLessons`): lições de aulas que aconteceram em que o
  aluno foi marcado ausente (ou justificado) e que ele não assistiu depois. Só
  conta falta explícita.

## Taxas de presença

- **Por aluno, na página do grupo** (`attendanceByStudent`): presentes ÷
  marcados, **excluindo faltas justificadas** do total.
- **Por grupo** (`listGroups`/`fetchGroup` em `groups.ts`): presentes ÷ todas as
  linhas de `group_attendance` do grupo.
- **Por aluno, no perfil do aluno** (`student-profile.ts`): presentes ÷ todas as
  linhas daquele aluno, em todos os grupos.

## Outros leitores

- **Dashboard do professor** (`upcoming-classes.tsx`): `listRegistersTakenOn`
  diz quais grupos já têm aula registrada em cada dia, e a soma de presentes ÷
  marcados.
- **Perfil do aluno** (staff): lista as aulas do aluno e permite corrigir uma
  marcação (`setClassAttendance`). Isso só alterna present/absent numa linha
  existente e **zera `excused`**. Não cria aula nem marcação nova.
- **App do aluno (lexicon-mobile)**: lê a view `student_class_plan`, cujo
  `taught_on` é a primeira data de uma aula do grupo com essa lição e alguém
  presente. O aluno não lê `group_attendance` diretamente.

## Permissões (RLS)

- `group_classes`, `group_attendance` e `group_cancelled_classes` exigem
  `owns_group(group_id)`. Para gravar presença também é preciso
  `owns_student(student_id)`.
- `save_group_class` é `security invoker`, então o RLS acima vale dentro da RPC.
- Tudo isso é dado de staff. Alunos só veem o que a view `student_class_plan`
  expõe.

## Inconsistências conhecidas

- A falta justificada é excluída da taxa na página do grupo, mas **conta como
  falta** na taxa do grupo e na taxa do perfil do aluno.
- O comentário de `setClassAttendance` (`student-profile.ts`) ainda diz que
  `group_attendance` carrega a lição do dia, o que deixou de ser verdade na 0028.

## Arquivos principais

- `supabase/migrations/0007_groups_and_finances.sql`: tabelas originais e RLS
- `supabase/migrations/0025_flexible_class_plan.sql`: `excused`, `group_cancelled_classes`
- `supabase/migrations/0026`–`0027`: view `student_class_plan`
- `supabase/migrations/0028_group_classes.sql`: `group_classes`, `save_group_class`
- `src/features/groups/data/group-classes.ts`: leitura/gravação de aulas, sugestão, taxas, lições perdidas
- `src/features/groups/data/class-plan.ts`: plano, dias pendentes, "sem aula", `reflowPlan`
- `src/features/groups/components/group-page.tsx` e `group-register-table.tsx`: a tela do registro
- `src/features/students/data/student-profile.ts`: presença no perfil do aluno
