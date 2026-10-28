// Test delle utility del renderer scritte in TypeScript, compilate prima da
// tsc (tests/tsconfig.json, npm test) senza passare da Vite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeItinerary, normalizeSavedTrip, formatModelName } from '../node_modules/.cache/motomentor-tests/src/utils/itinerary.js';
import { todayLocalISO, formatLocalDate, localDateTime } from '../node_modules/.cache/motomentor-tests/src/utils/hooks.js';
import { pickActiveVehicleId } from '../node_modules/.cache/motomentor-tests/src/utils/garage.js';

test('normalizeItinerary rifiuta ciò che non è un itinerario', () => {
  assert.equal(normalizeItinerary(null), null);
  assert.equal(normalizeItinerary({}), null);
  assert.equal(normalizeItinerary({ dailySchedule: 'no' }), null);
});

test('normalizeItinerary riconduce i campi ai tipi attesi', () => {
  const it = normalizeItinerary({
    tripTitle: 'T',
    dailySchedule: [
      {
        day: '2',
        stageKilometers: '120',
        gpxTrack: [{ lat: '45', lon: 7 }, { lat: 'x', lon: 1 }, { lat: 200, lon: 0 }],
        weatherForecast: null,
        activities: 'no',
      },
      null,
      'stringa',
    ],
  });
  assert.equal(it.dailySchedule.length, 1);
  const [day] = it.dailySchedule;
  assert.equal(day.day, 2);
  assert.equal(day.stageKilometers, 120);          // numero, non concatenazione di stringhe
  assert.deepEqual(day.gpxTrack, [{ lat: 45, lon: 7 }]);
  assert.equal(day.weatherForecast.icon, 'cloud');
  assert.deepEqual(day.activities, []);
});

test('normalizeSavedTrip scarta i viaggi malformati e normalizza il diario', () => {
  assert.equal(normalizeSavedTrip({ id: 'a', itinerary: {} }), null);
  assert.equal(normalizeSavedTrip({ itinerary: { dailySchedule: [] } }), null);
  const trip = normalizeSavedTrip({ id: 'a', itinerary: { dailySchedule: [] }, diaryEntries: [{ day: 1 }, 5] });
  assert.deepEqual(trip.diaryEntries, [{ day: 1, content: '' }]);
});

test('todayLocalISO usa il fuso locale', () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  assert.equal(todayLocalISO(), `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
});

test('le date YYYY-MM-DD non slittano di un giorno', () => {
  assert.equal(formatLocalDate('2026-03-01'), '01/03/2026');
  assert.equal(formatLocalDate(''), 'N/D');
  assert.ok(localDateTime('2026-03-02') > localDateTime('2026-03-01'));
});

test('pickActiveVehicleId: tiene il veicolo salvato, altrimenti il primo', () => {
  const vehicles = [{ id: 'a' }, { id: 'b' }];
  assert.equal(pickActiveVehicleId(vehicles, 'b'), 'b');
  // Primo avvio (nessuna selezione) o veicolo salvato eliminato.
  assert.equal(pickActiveVehicleId(vehicles, null), 'a');
  assert.equal(pickActiveVehicleId(vehicles, 'x'), 'a');
  assert.equal(pickActiveVehicleId([], 'a'), null);
});

test('generatedBy: conservato se stringa, ignorato altrimenti; nome leggibile', () => {
  assert.equal(normalizeItinerary({ dailySchedule: [], generatedBy: ' gemini-3.6-flash ' }).generatedBy, 'gemini-3.6-flash');
  assert.equal('generatedBy' in normalizeItinerary({ dailySchedule: [] }), false);
  assert.equal('generatedBy' in normalizeItinerary({ dailySchedule: [], generatedBy: 42 }), false);
  assert.equal(formatModelName('gemini-3.6-flash'), 'Gemini 3.6 Flash');
  assert.equal(formatModelName('models/gemini-3.1-pro-preview'), 'Gemini 3.1 Pro Preview');
});
