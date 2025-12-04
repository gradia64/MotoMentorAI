
import sql from './db.js';

// Helper per gestire stringhe vuote come NULL (importante per le date in Postgres)
const nullable = (value) => {
  if (value === undefined || value === null || value === '') return null;
  return value;
};

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT 
          id, model, year, kilometers, photo, 
          vin, purchase_date as "purchaseDate",
          displacement, power, 
          front_tire as "frontTire", rear_tire as "rearTire", 
          to_char(insurance_expiry, 'YYYY-MM-DD') as "insuranceExpiry", 
          to_char(tax_expiry, 'YYYY-MM-DD') as "taxExpiry", 
          to_char(inspection_expiry, 'YYYY-MM-DD') as "inspectionExpiry", 
          notes 
        FROM vehicles
      `;
      return res.status(200).json(rows);
    } 
    
    if (req.method === 'POST') {
      const v = req.body;
      await sql`
        INSERT INTO vehicles (
          id, model, year, kilometers, photo, vin, purchase_date,
          displacement, power, front_tire, rear_tire, 
          insurance_expiry, tax_expiry, inspection_expiry, notes
        )
        VALUES (
          ${v.id}, ${v.model}, ${v.year}, ${v.kilometers}, ${nullable(v.photo)}, ${nullable(v.vin)}, ${nullable(v.purchaseDate)},
          ${nullable(v.displacement)}, ${nullable(v.power)}, ${nullable(v.frontTire)}, ${nullable(v.rearTire)}, 
          ${nullable(v.insuranceExpiry)}, ${nullable(v.taxExpiry)}, ${nullable(v.inspectionExpiry)}, ${nullable(v.notes)}
        )
      `;
      return res.status(201).json({ message: 'Vehicle created' });
    }

    if (req.method === 'PUT') {
      const v = req.body;
      await sql`
        UPDATE vehicles SET 
          model=${v.model}, 
          year=${v.year}, 
          kilometers=${v.kilometers}, 
          photo=${nullable(v.photo)}, 
          vin=${nullable(v.vin)},
          purchase_date=${nullable(v.purchaseDate)},
          displacement=${nullable(v.displacement)}, 
          power=${nullable(v.power)}, 
          front_tire=${nullable(v.frontTire)}, 
          rear_tire=${nullable(v.rearTire)}, 
          insurance_expiry=${nullable(v.insuranceExpiry)}, 
          tax_expiry=${nullable(v.taxExpiry)}, 
          inspection_expiry=${nullable(v.inspectionExpiry)}, 
          notes=${nullable(v.notes)}
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