# Write-up authoring rules

- Every write-up must be maintained as a Vietnamese/English pair.
- The Vietnamese source is `src/content/writeups/<platform>/<slug>.md`; the English source is `src/content/writeups/<platform>/<slug>.en.md`.
- Both files must use the same `translationKey`, metadata values, images, code blocks, commands, and technical facts. Set `language` to `vi` or `en` respectively.
- Translate prose, headings, descriptions, table labels, image alternative text, and accessibility text. Do not translate commands, code, flags, payloads, paths, endpoint names, credentials, or quoted tool output.
- When adding, editing, or publishing a write-up, update both language files in the same change. Never publish one side while its translation is missing or stale.
- Run `npm run build` after content or routing changes. Treat broken translation links as a release blocker.
- Use `npm run new -- "<platform>" "<title>" <difficulty> <category>` to scaffold both language files together.
