// Gestione errori del layer di persistenza locale (sostituisce firestoreErrors.ts).
// Registra l'errore con contesto e restituisce un messaggio umano mostrabile
// nella notifica dell'app (il vecchio handler rilanciava un JSON, poco leggibile).

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface DataErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

export function handleDataError(error: any, operationType: OperationType, path: string | null): string {
  const message = error instanceof Error ? error.message : String(error);
  const errInfo: DataErrorInfo = {
    error: message,
    operationType,
    path
  };
  console.error('Errore persistenza locale: ', JSON.stringify(errInfo));

  // Messaggi notificabili per l'utente finale.
  if (message.includes('Sessione non autenticata')) {
    return 'Sessione scaduta: rieffettua l\'accesso.';
  }
  if (message.includes('Accesso negato')) {
    return 'Accesso negato ai dati (documento fuori dal tuo profilo).';
  }

  return `Errore durante il salvataggio dei dati (${operationType}). Controlla la console per i dettagli.`;
}
