// Sceglie il veicolo attivo: quello salvato se esiste ancora nel garage,
// altrimenti il primo disponibile. Senza veicoli non c'è un attivo.
// Senza questo fallback, al primo veicolo aggiunto (o dopo averne eliminato
// uno) le funzioni IA restavano disabilitate finché non si cliccava "Seleziona".
export const pickActiveVehicleId = (vehicles: { id: string }[], savedId: string | null): string | null => {
    if (savedId && vehicles.some(v => v.id === savedId)) return savedId;
    return vehicles[0]?.id ?? null;
};
