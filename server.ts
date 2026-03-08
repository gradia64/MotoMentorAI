import express from "express";
import { createServer as createViteServer } from "vite";
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const JWT_SECRET = process.env.JWT_SECRET || 'motomentor-secret-key-123';

const getConnectionString = () => {
  return process.env.POSTGRES_URL || 
         process.env.DATABASE_URL || 
         process.env.POSTGRES_PRISMA_URL || 
         process.env.POSTGRES_URL_NON_POOLING;
};

let sqlClient: any = null;

const getSql = () => {
  if (!sqlClient) {
    const connectionString = getConnectionString();
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    console.log("Connecting to DB with URL:", connectionString.replace(/:[^:@]+@/, ':***@'));
    sqlClient = neon(connectionString);
  }
  return sqlClient;
};

const nullable = (value: any) => {
  if (value === undefined || value === null || value === '') return null;
  return value;
};

async function initDb() {
  try {
    const sql = getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS vehicles (
        id VARCHAR(255) PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        model VARCHAR(255),
        year VARCHAR(255),
        kilometers VARCHAR(255),
        photo TEXT,
        vin VARCHAR(255),
        purchase_date VARCHAR(255),
        displacement VARCHAR(255),
        power VARCHAR(255),
        front_tire VARCHAR(255),
        rear_tire VARCHAR(255),
        insurance_expiry VARCHAR(255),
        tax_expiry VARCHAR(255),
        inspection_expiry VARCHAR(255),
        notes TEXT
      );
    `;
    await sql`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;`;
    await sql`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vin VARCHAR(255);`;
    await sql`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS purchase_date VARCHAR(255);`;
    await sql`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS displacement VARCHAR(255);`;
    await sql`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS power VARCHAR(255);`;
    await sql`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS front_tire VARCHAR(255);`;
    await sql`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS rear_tire VARCHAR(255);`;
    await sql`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS insurance_expiry VARCHAR(255);`;
    await sql`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tax_expiry VARCHAR(255);`;
    await sql`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS inspection_expiry VARCHAR(255);`;
    await sql`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS notes TEXT;`;
    
    // Ensure columns are VARCHAR in case they were previously created as INTEGER
    try {
        await sql`ALTER TABLE vehicles ALTER COLUMN displacement TYPE VARCHAR(255);`;
        await sql`ALTER TABLE vehicles ALTER COLUMN power TYPE VARCHAR(255);`;
        await sql`ALTER TABLE vehicles ALTER COLUMN front_tire TYPE VARCHAR(255);`;
        await sql`ALTER TABLE vehicles ALTER COLUMN rear_tire TYPE VARCHAR(255);`;
    } catch (e) {
        console.log("Could not alter vehicle columns, they might not exist yet or are already correct.");
    }
    
    await sql`
      CREATE TABLE IF NOT EXISTS saved_trips (
        id VARCHAR(255) PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        data JSONB
      );
    `;
    await sql`ALTER TABLE saved_trips ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;`;
    await sql`ALTER TABLE saved_trips ADD COLUMN IF NOT EXISTS data JSONB;`;
    
    await sql`
      CREATE TABLE IF NOT EXISTS diagnoses (
        id VARCHAR(255) PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        data JSONB
      );
    `;
    await sql`ALTER TABLE diagnoses ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;`;
    await sql`ALTER TABLE diagnoses ADD COLUMN IF NOT EXISTS data JSONB;`;
    
    await sql`
      CREATE TABLE IF NOT EXISTS maintenance_log (
        id VARCHAR(255) PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        data JSONB
      );
    `;
    await sql`ALTER TABLE maintenance_log ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;`;
    await sql`ALTER TABLE maintenance_log ADD COLUMN IF NOT EXISTS data JSONB;`;
    
    await sql`
      CREATE TABLE IF NOT EXISTS reminders (
        id VARCHAR(255) PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        data JSONB
      );
    `;
    await sql`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;`;
    await sql`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS data JSONB;`;
    
    await sql`
      CREATE TABLE IF NOT EXISTS chats (
        id VARCHAR(255) PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        data JSONB
      );
    `;
    await sql`ALTER TABLE chats ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;`;
    await sql`ALTER TABLE chats ADD COLUMN IF NOT EXISTS data JSONB;`;
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw error;
  }
}

const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Initialize DB on first request if not done
  let dbInitialized = false;
  let dbError: string | null = null;
  
  app.use(async (req, res, next) => {
    if (req.path.startsWith('/api') && !dbInitialized && !dbError) {
      try {
        await initDb();
        dbInitialized = true;
      } catch (e: any) {
        dbError = e.message || String(e);
      }
    }
    
    if (req.path.startsWith('/api') && dbError) {
      return res.status(500).json({ 
        error: `Database connection failed: ${dbError}. Please check your DATABASE_URL environment variable and ensure the password is correct.` 
      });
    }
    
    next();
  });

  // Auth Routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username e password sono richiesti' });
      }

      const sql = getSql();
      const existingUser = await sql`SELECT * FROM users WHERE username = ${username}`;
      if (existingUser.length > 0) {
        return res.status(400).json({ error: 'Nome utente già in uso' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await sql`
        INSERT INTO users (username, password) 
        VALUES (${username}, ${hashedPassword}) 
        RETURNING id, username
      `;
      
      const user = result[0];
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
      
      res.json({ token, user: { id: user.id, username: user.username } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      const sql = getSql();
      const users = await sql`SELECT * FROM users WHERE username = ${username}`;
      
      if (users.length === 0) {
        return res.status(400).json({ error: 'Credenziali non valide' });
      }

      const user = users[0];
      const validPassword = await bcrypt.compare(password, user.password);
      
      if (!validPassword) {
        return res.status(400).json({ error: 'Credenziali non valide' });
      }

      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
      res.json({ token, user: { id: user.id, username: user.username } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/auth/me', authenticateToken, async (req: any, res: any) => {
    res.json({ user: req.user });
  });

  // Garage Routes
  app.get('/api/garage', authenticateToken, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const rows = await sql`
        SELECT 
          id, model, year, kilometers, photo, 
          vin, purchase_date as "purchaseDate",
          displacement, power, 
          front_tire as "frontTire", rear_tire as "rearTire", 
          insurance_expiry as "insuranceExpiry", 
          tax_expiry as "taxExpiry", 
          inspection_expiry as "inspectionExpiry", 
          notes 
        FROM vehicles
        WHERE user_id = ${req.user.id}
      `;
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/garage', authenticateToken, async (req: any, res: any) => {
    try {
      const sql = getSql();
      const v = req.body;
      await sql`
        INSERT INTO vehicles (
          id, user_id, model, year, kilometers, photo, vin, purchase_date,
          displacement, power, front_tire, rear_tire, 
          insurance_expiry, tax_expiry, inspection_expiry, notes
        )
        VALUES (
          ${v.id}, ${req.user.id}, ${v.model}, ${v.year}, ${v.kilometers}, ${nullable(v.photo)}, ${nullable(v.vin)}, ${nullable(v.purchaseDate)},
          ${nullable(v.displacement)}, ${nullable(v.power)}, ${nullable(v.frontTire)}, ${nullable(v.rearTire)}, 
          ${nullable(v.insuranceExpiry)}, ${nullable(v.taxExpiry)}, ${nullable(v.inspectionExpiry)}, ${nullable(v.notes)}
        )
      `;
      res.status(201).json({ message: 'Vehicle created' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/garage', authenticateToken, async (req: any, res: any) => {
    try {
      const sql = getSql();
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
        WHERE id=${v.id} AND user_id=${req.user.id}
      `;
      res.json({ message: 'Vehicle updated' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/garage/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const sql = getSql();
      await sql`DELETE FROM vehicles WHERE id=${req.params.id} AND user_id=${req.user.id}`;
      res.json({ message: 'Vehicle deleted' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Trips
  app.get('/api/trips', authenticateToken, async (req: any, res: any) => {
    try { const sql = getSql(); const rows = await sql`SELECT data FROM saved_trips WHERE user_id = ${req.user.id}`; res.json(rows.map((r: any) => r.data)); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/trips', authenticateToken, async (req: any, res: any) => {
    try { const sql = getSql(); const item = req.body; await sql`INSERT INTO saved_trips (id, user_id, data) VALUES (${item.id}, ${req.user.id}, ${JSON.stringify(item)}) ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(item)}`; res.status(201).json({ message: 'Saved' }); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.delete('/api/trips/:id', authenticateToken, async (req: any, res: any) => {
    try { const sql = getSql(); await sql`DELETE FROM saved_trips WHERE id=${req.params.id} AND user_id=${req.user.id}`; res.json({ message: 'Deleted' }); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Diagnoses
  app.get('/api/diagnoses', authenticateToken, async (req: any, res: any) => {
    try { const sql = getSql(); const rows = await sql`SELECT data FROM diagnoses WHERE user_id = ${req.user.id}`; res.json(rows.map((r: any) => r.data)); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/diagnoses', authenticateToken, async (req: any, res: any) => {
    try { const sql = getSql(); const item = req.body; await sql`INSERT INTO diagnoses (id, user_id, data) VALUES (${item.id}, ${req.user.id}, ${JSON.stringify(item)}) ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(item)}`; res.status(201).json({ message: 'Saved' }); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.delete('/api/diagnoses/:id', authenticateToken, async (req: any, res: any) => {
    try { const sql = getSql(); await sql`DELETE FROM diagnoses WHERE id=${req.params.id} AND user_id=${req.user.id}`; res.json({ message: 'Deleted' }); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Maintenance
  app.get('/api/maintenance', authenticateToken, async (req: any, res: any) => {
    try { const sql = getSql(); const rows = await sql`SELECT data FROM maintenance_log WHERE user_id = ${req.user.id}`; res.json(rows.map((r: any) => r.data)); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/maintenance', authenticateToken, async (req: any, res: any) => {
    try { const sql = getSql(); const item = req.body; await sql`INSERT INTO maintenance_log (id, user_id, data) VALUES (${item.id}, ${req.user.id}, ${JSON.stringify(item)}) ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(item)}`; res.status(201).json({ message: 'Saved' }); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.delete('/api/maintenance/:id', authenticateToken, async (req: any, res: any) => {
    try { const sql = getSql(); await sql`DELETE FROM maintenance_log WHERE id=${req.params.id} AND user_id=${req.user.id}`; res.json({ message: 'Deleted' }); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Reminders
  app.get('/api/reminders', authenticateToken, async (req: any, res: any) => {
    try { const sql = getSql(); const rows = await sql`SELECT data FROM reminders WHERE user_id = ${req.user.id}`; res.json(rows.map((r: any) => r.data)); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/reminders', authenticateToken, async (req: any, res: any) => {
    try { const sql = getSql(); const item = req.body; await sql`INSERT INTO reminders (id, user_id, data) VALUES (${item.id}, ${req.user.id}, ${JSON.stringify(item)}) ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(item)}`; res.status(201).json({ message: 'Saved' }); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.delete('/api/reminders/:id', authenticateToken, async (req: any, res: any) => {
    try { const sql = getSql(); await sql`DELETE FROM reminders WHERE id=${req.params.id} AND user_id=${req.user.id}`; res.json({ message: 'Deleted' }); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Chats
  app.get('/api/chats', authenticateToken, async (req: any, res: any) => {
    try { const sql = getSql(); const rows = await sql`SELECT data FROM chats WHERE user_id = ${req.user.id}`; res.json(rows.map((r: any) => r.data)); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/chats', authenticateToken, async (req: any, res: any) => {
    try { const sql = getSql(); const item = req.body; await sql`INSERT INTO chats (id, user_id, data) VALUES (${item.id}, ${req.user.id}, ${JSON.stringify(item)}) ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(item)}`; res.status(201).json({ message: 'Saved' }); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.delete('/api/chats/:id', authenticateToken, async (req: any, res: any) => {
    try { const sql = getSql(); await sql`DELETE FROM chats WHERE id=${req.params.id} AND user_id=${req.user.id}`; res.json({ message: 'Deleted' }); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
