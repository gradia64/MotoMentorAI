
import sql from './db.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT data FROM saved_trips`;
      const trips = rows.map(row => row.data);
      return res.status(200).json(trips);
    } 
    
    if (req.method === 'POST') {
      const trip = req.body;
      await sql`
        INSERT INTO saved_trips (id, data)
        VALUES (${trip.id}, ${trip})
      `;
      return res.status(201).json({ message: 'Trip saved' });
    }

    if (req.method === 'PUT') {
      const trip = req.body;
      await sql`
        INSERT INTO saved_trips (id, data)
        VALUES (${trip.id}, ${trip})
        ON CONFLICT (id) DO UPDATE SET data = ${trip}
      `;
      return res.status(200).json({ message: 'Trip updated' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM saved_trips WHERE id=${id}`;
      return res.status(200).json({ message: 'Trip deleted' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error("Database Error in Trips API:", error);
    res.status(500).json({ error: error.message });
  }
}