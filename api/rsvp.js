import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const slug = s =>
  s.toLowerCase().trim().replace(/[^a-z0-9؀-ۿ]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

let ready;
function ensureTable() {
  ready ??= sql`
    CREATE TABLE IF NOT EXISTS rsvps (
      slug      text PRIMARY KEY,
      name      text NOT NULL,
      attending text NOT NULL,
      plusone   text NOT NULL,
      ts        timestamptz NOT NULL DEFAULT now()
    )`;
  return ready;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    await ensureTable();

    if (req.method === "GET") {
      const rows = await sql`
        SELECT name, attending, plusone, ts FROM rsvps ORDER BY ts DESC`;
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(
        rows.map(r => ({ ...r, ts: new Date(r.ts).toISOString() }))
      );
    }

    if (req.method === "POST") {
      const { name, attending, plusone } = req.body || {};
      if (typeof name !== "string" || name.trim().length < 2 || name.length > 80)
        return res.status(400).json({ error: "Please provide your name." });
      if (attending !== "yes" && attending !== "no")
        return res.status(400).json({ error: "Attendance must be yes or no." });

      const cleanName = name.trim();
      const key = slug(cleanName);
      if (!key) return res.status(400).json({ error: "Please provide a valid name." });
      const plus = attending === "yes" && plusone === "yes" ? "yes" : "no";

      await sql`
        INSERT INTO rsvps (slug, name, attending, plusone, ts)
        VALUES (${key}, ${cleanName}, ${attending}, ${plus}, now())
        ON CONFLICT (slug) DO UPDATE
          SET name = EXCLUDED.name,
              attending = EXCLUDED.attending,
              plusone = EXCLUDED.plusone,
              ts = now()`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Database error" });
  }
}
