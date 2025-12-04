
import pool from './db.js';

export default async function handler(req, res) {
  const client = await pool.connect();
  try {
    if (req.method === 'GET') {
      const result = await client.query(`
        SELECT id, vehicle_id as "vehicleId", date, problem_description as "problemDescription", diagnosis_text as "diagnosisText"
        FROM saved_diagnoses ORDER BY date DESC
      `);
      return res.status(200).json(result.rows);
    } 
    
    if (req.method === 'POST') {
      const d = req.body;
      await client.query(`
        INSERT INTO saved_diagnoses (id, vehicle_id, date, problem_description, diagnosis_text)
        VALUES ($1, $2, $3, $4, $5)
      `, [d.id, d.vehicleId, d.date, d.problemDescription, d.diagnosisText]);
      return res.status(201).json({ message: 'Diagnosis saved' });
    }

    if (req.method === 'PUT') {
        const d = req.body;
        await client.query(`
          UPDATE saved_diagnoses SET
            vehicle_id=$2, date=$3, problem_description=$4, diagnosis_text=$5
          WHERE id=$1
        `, [d.id, d.vehicleId, d.date, d.problemDescription, d.diagnosisText]);
        return res.status(200).json({ message: 'Diagnosis updated' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await client.query('DELETE FROM saved_diagnoses WHERE id=$1', [id]);
      return res.status(200).json({ message: 'Diagnosis deleted' });
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
