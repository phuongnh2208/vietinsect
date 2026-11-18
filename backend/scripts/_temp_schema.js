const knex = require('./src/config/knex');
(async () => {
  const cols = await knex.raw("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='specimens' ORDER BY ordinal_position");
  console.log(cols.rows.map(r => r.column_name + ' (' + r.data_type + ')').join('\n'));
  const dna = await knex.raw("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='dna_sequences' ORDER BY ordinal_position");
  console.log('--- dna_sequences ---');
  console.log(dna.rows.map(r => r.column_name + ' (' + r.data_type + ')').join('\n'));
  await knex.destroy();
})();
