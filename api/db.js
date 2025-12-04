
import { neon } from '@neondatabase/serverless';

// Recupera la stringa di connessione controllando le varie nomenclature standard usate da Vercel e Neon.
// L'ordine di priorità preferisce la connessione "Pooled" (migliore per serverless).
const connectionString = 
  process.env.DATABASE_URL || 
  process.env.POSTGRES_URL || 
  process.env.POSTGRES_PRISMA_URL || 
  process.env.POSTGRES_URL_NON_POOLING;

// Controllo di sicurezza per l'ambiente
if (!connectionString) {
  console.warn("ATTENZIONE: Nessuna variabile d'ambiente per il database trovata (es. DATABASE_URL o POSTGRES_URL). Le API Cloud falliranno se invocate.");
}

// Inizializza il client. 
// Se la stringa manca (es. in build o preview), usa un placeholder valido sintatticamente 
// per evitare che l'app vada in crash all'avvio. L'errore reale apparirà solo se si tenta una query.
const sql = neon(connectionString || "postgres://user:pass@endpoint/db");

export default sql;
