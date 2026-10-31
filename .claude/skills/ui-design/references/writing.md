# ui-design: UI text

Part of the `ui-design` skill ([SKILL.md](../SKILL.md)).

## Writing UI text

All UI text is in Bulgarian, in the polite plural form («Изберете», «Намерете»).

- **Name things as the user knows them:** «Моите часове», «Работно време», «Почивни дни», «Свободни часове». Not system words like «слот» or «резервация №».
- **A button says what happens:** «Запази час», «Запази промените», «Добави услуга». Never «Изпрати», «ОК» or «Потвърди» on their own.
- **An action keeps its name through the flow:** «Запази час» → «Часът е запазен.» «Откажи часа» → the dialog asks «Да откажем ли часа в 14:30?» with «Откажи часа» and «Назад» → «Часът е отказан.»
- **Errors the client writes** say what happened and how to fix it, without apologies: «Изберете час, за да продължите.» Server messages are shown as they come.
- **Empty states invite an action:** «Още нямате запазени часове.» with a link «Намерете маникюрист».
- Sentence case, no filler, no exclamation marks, no emoji. Each piece of text does one job.
