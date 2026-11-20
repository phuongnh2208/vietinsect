.PHONY: migrate seed unlock-admin

migrate:
	pnpm --filter backend exec knex migrate:latest

seed:
	pnpm --filter backend exec knex seed:run

unlock-admin:
	node backend/scripts/unlock-admin.js $(user)
