
import sql from './db.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql('SELECT id, model, year, kilometers, photo, displacement, power, front_tire as "frontTire", rear_tire as "rearTire", to_char(insurance_expiry, \'YYYY-MM-DD\') as "insuranceExpiry", to_char(tax_expiry, \'YYYY-MM-DD\') as "taxExpiry", to_char(inspection_expiry, \'YYYY-MM-DD\') as "inspectionExpiry", notes FROM vehicles');
      return res.status(200).json(rows);
    } 
    
    if (req.method === 'POST') {
      const v = req.body;
      await sql(`
        INSERT INTO vehicles (id, model, year, kilometers, photo, displacement, power, front_tire, rear_tire, insurance_expiry, tax_expiry, inspection_expiry, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [v.id, v.model, v.year, v.kilometers, v.photo, v.displacement, v.power, v.frontTire, v.rearTire, v.insuranceExpiry || null, v.taxExpiry || null, v.inspectionExpiry || null, v.notes]);
      return res.status(201).json({ message: 'Vehicle created' });
    }

    if (req.method === 'PUT') {
      const v = req.body;
      await sql(`
        UPDATE vehicles SET 
          model=$2, year=$3, kilometers=$4, photo=$5, displacement=$6, power=$7, 
          front_tire=$8, rear_tire=$9, insurance_expiry=$10, tax_expiry=$11, inspection_expiry=$12, notes=$13
        WHERE id=$1
      `, [v.id, v.model, v.year, v.kilometers, v.photo, v.displacement, v.power, v.frontTire, v.rearTire, v.insuranceExpiry || null, v.taxExpiry || null, v.inspectionExpiry || null, v.notes]);
      return res.status(200).json({ message: 'Vehicle updated' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql('DELETE FROM vehicles WHERE id=$1', [id]);
      return res.status(200).json({ message: 'Vehicle deleted' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
}
