
import sql from './db.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM maintenance_logs ORDER BY date DESC`;
      return res.status(200).json(rows);
    } 
    
    if (req.method === 'POST') {
      const l = req.body;
      await sql`
        INSERT INTO maintenance_logs (id, date, kilometers, type, description, cost)
        VALUES (${l.id}, ${l.date}, ${l.kilometers}, ${l.type}, ${l.description}, ${l.cost})
      `;
      return res.status(201).json({ message: 'Log created' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM maintenance_logs WHERE id=${id}`;
      return res.status(200).json({ message: 'Log deleted' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error("Database Error in Maintenance API:", error);
    res.status(500).json({ error: error.message });
  }
}