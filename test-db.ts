import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config({ override: true });

async function testConnection() {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) {
    console.error("No POSTGRES_URL_NON_POOLING found");
    return;
  }
  console.log("Testing connection to:", connectionString.replace(/:[^:@]+@/, ':***@'));
  
  try {
    const sql = neon(connectionString);
    const result = await sql`SELECT 1 as connected`;
    console.log("Connection successful:", result);
  } catch (error) {
    console.error("Connection failed:", error);
  }
}

testConnection();
