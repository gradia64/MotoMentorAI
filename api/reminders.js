
import sql from './db.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT id, description, target_kilometers as "targetKilometers" FROM reminders`;
      return res.status(200).json(rows);
    } 
    
    if (req.method === 'POST') {
      const r = req.body;
      await sql`
        INSERT INTO reminders (id, description, target_kilometers)
        VALUES (${r.id}, ${r.description}, ${r.targetKilometers})
      `;
      return res.status(201).json({ message: 'Reminder created' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM reminders WHERE id=${id}`;
      return res.status(200).json({ message: 'Reminder deleted' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
}
