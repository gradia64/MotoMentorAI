
import pool from './db.js';

export default async function handler(req, res) {
  const client = await pool.connect();
  try {
    if (req.method === 'GET') {
      const result = await client.query('SELECT id, description, target_kilometers as "targetKilometers" FROM reminders');
      return res.status(200).json(result.rows);
    } 
    
    if (req.method === 'POST') {
      const r = req.body;
      await client.query(`
        INSERT INTO reminders (id, description, target_kilometers)
        VALUES ($1, $2, $3)
      `, [r.id, r.description, r.targetKilometers]);
      return res.status(201).json({ message: 'Reminder created' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await client.query('DELETE FROM reminders WHERE id=$1', [id]);
      return res.status(200).json({ message: 'Reminder deleted' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
}
