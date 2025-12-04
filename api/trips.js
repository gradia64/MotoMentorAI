
import pool from './db.js';

export default async function handler(req, res) {
  const client = await pool.connect();
  try {
    if (req.method === 'GET') {
      const result = await client.query('SELECT data FROM saved_trips');
      // Estrae direttamente l'oggetto JSON dalla colonna 'data'
      const trips = result.rows.map(row => row.data);
      return res.status(200).json(trips);
    } 
    
    if (req.method === 'POST') {
      const trip = req.body;
      await client.query(`
        INSERT INTO saved_trips (id, data)
        VALUES ($1, $2)
      `, [trip.id, trip]);
      return res.status(201).json({ message: 'Trip saved' });
    }

    if (req.method === 'PUT') {
      const trip = req.body;
      await client.query(`
        INSERT INTO saved_trips (id, data)
        VALUES ($1, $2)
        ON CONFLICT (id) DO UPDATE SET data = $2
      `, [trip.id, trip]);
      return res.status(200).json({ message: 'Trip updated' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await client.query('DELETE FROM saved_trips WHERE id=$1', [id]);
      return res.status(200).json({ message: 'Trip deleted' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
}
