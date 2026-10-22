// Seeds the curated crisis agenda pool. Safe to run repeatedly: agendas are matched by title.
import { and, eq } from "drizzle-orm";
import { AGENDA_POOL } from "./agendaPool.js";
import { db } from "./index.js";
import { agendas } from "./schema.js";

async function main() {
  let created = 0;
  for (const agenda of AGENDA_POOL) {
    const [existing] = await db
      .select({ id: agendas.id })
      .from(agendas)
      .where(and(eq(agendas.title, agenda.title), eq(agendas.isCustom, false)));
    if (existing) {
      await db.update(agendas).set(agenda).where(eq(agendas.id, existing.id));
    } else {
      await db.insert(agendas).values(agenda);
      created++;
    }
  }
  console.log(`Seeded agendas: ${created} new, ${AGENDA_POOL.length - created} updated.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
