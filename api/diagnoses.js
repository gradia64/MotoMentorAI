
import sql from './db.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, vehicle_id as "vehicleId", date, problem_description as "problemDescription", diagnosis_text as "diagnosisText"
        FROM saved_diagnoses ORDER BY date DESC
      `;
      return res.status(200).json(rows);
    } 
    
    if (req.method === 'POST') {
      const d = req.body;
      await sql`
        INSERT INTO saved_diagnoses (id, vehicle_id, date, problem_description, diagnosis_text)
        VALUES (${d.id}, ${d.vehicleId}, ${d.date}, ${d.problemDescription}, ${d.diagnosisText})
      `;
      return res.status(201).json({ message: 'Diagnosis saved' });
    }

    if (req.method === 'PUT') {
        const d = req.body;
        await sql`
          UPDATE saved_diagnoses SET
            vehicle_id=${d.vehicleId}, date=${d.date}, problem_description=${d.problemDescription}, diagnosis_text=${d.diagnosisText}
          WHERE id=${d.id}
        `;
        return res.status(200).json({ message: 'Diagnosis updated' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM saved_diagnoses WHERE id=${id}`;
      return res.status(200).json({ message: 'Diagnosis deleted' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error("Database Error in Diagnoses API:", error);
    res.status(500).json({ error: error.message });
  }
}