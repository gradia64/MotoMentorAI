
import sql from './db.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT id, model, year, kilometers, photo, displacement, power, front_tire as "frontTire", rear_tire as "rearTire", to_char(insurance_expiry, 'YYYY-MM-DD') as "insuranceExpiry", to_char(tax_expiry, 'YYYY-MM-DD') as "taxExpiry", to_char(inspection_expiry, 'YYYY-MM-DD') as "inspectionExpiry", notes FROM vehicles`;
      return res.status(200).json(rows);
    } 
    
    if (req.method === 'POST') {
      const v = req.body;
      await sql`
        INSERT INTO vehicles (id, model, year, kilometers, photo, displacement, power, front_tire, rear_tire, insurance_expiry, tax_expiry, inspection_expiry, notes)
        VALUES (${v.id}, ${v.model}, ${v.year}, ${v.kilometers}, ${v.photo}, ${v.displacement}, ${v.power}, ${v.frontTire}, ${v.rearTire}, ${v.insuranceExpiry || null}, ${v.taxExpiry || null}, ${v.inspectionExpiry || null}, ${v.notes})
      `;
      return res.status(201).json({ message: 'Vehicle created' });
    }

    if (req.method === 'PUT') {
      const v = req.body;
      await sql`
        UPDATE vehicles SET 
          model=${v.model}, year=${v.year}, kilometers=${v.kilometers}, photo=${v.photo}, displacement=${v.displacement}, power=${v.power}, 
          front_tire=${v.frontTire}, rear_tire=${v.rearTire}, insurance_expiry=${v.insuranceExpiry || null}, tax_expiry=${v.taxExpiry || null}, inspection_expiry=${v.inspectionExpiry || null}, notes=${v.notes}
        WHERE id=${v.id}
      `;
      return res.status(200).json({ message: 'Vehicle updated' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM vehicles WHERE id=${id}`;
      return res.status(200).json({ message: 'Vehicle deleted' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
}
