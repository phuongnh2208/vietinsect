.PHONY: migrate seed unlock-admin reindex

migrate:
	pnpm --filter backend exec knex migrate:latest

seed:
	pnpm --filter backend exec knex seed:run

unlock-admin:
	node backend/scripts/unlock-admin.js $(user)

reindex:
	node backend/scripts/reindex-es.js
