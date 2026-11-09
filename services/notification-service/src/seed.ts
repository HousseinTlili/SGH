import { randomUUID } from 'crypto';
import { pool, initDb } from './db';

const patients = ['Jean Dupont', 'Amira Ben Salah', 'Karim Trabelsi', 'Sonia Mansour', 'Yassine Gharbi', 'Leila Hammami', 'Mohamed Jlassi', 'Nour Chaabane'];
const doctors = ['Dr Alice Martin', 'Dr Bernard Dupont'];

function pick<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

(async () => {
  try {
    await initDb();
    for (let i = 0; i < 28; i++) {
      const cancelled = Math.random() < 0.3;
      const patient = pick(patients);
      const doctor = pick(doctors);
      const hours = Math.floor(Math.random() * 24 * 7);
      const read = hours > 30 ? Math.random() < 0.85 : Math.random() < 0.3;
      const scheduledAt = new Date(Date.now() + (1 + Math.floor(Math.random() * 10)) * 86400000).toISOString();
      const when = new Date(scheduledAt).toLocaleString('fr-FR');
      const type = cancelled ? 'appointment.cancelled' : 'appointment.created';
      const title = cancelled ? 'Rendez-vous annul\u00e9' : 'Nouveau rendez-vous';
      const message = cancelled
        ? `Le rendez-vous de ${patient} avec ${doctor} a \u00e9t\u00e9 annul\u00e9 (${when})`
        : `Un rendez-vous a \u00e9t\u00e9 programm\u00e9 pour ${patient} avec ${doctor} (${when})`;
      await pool.query(
        `INSERT INTO notifications (type, title, message, severity, payload, read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW() - ($7::int * INTERVAL '1 hour'))`,
        [type, title, message, cancelled ? 'WARNING' : 'INFO',
         JSON.stringify({ appointmentId: randomUUID(), patientName: patient, doctor, scheduledAt }),
         read, hours]
      );
    }
    const alerts: [string, string, string][] = [
      ['CRITICAL', 'Stock critique', 'Le stock de parac\u00e9tamol est sous le seuil minimal'],
      ['WARNING', 'Maintenance planifi\u00e9e', 'Une maintenance du syst\u00e8me est pr\u00e9vue ce soir \u00e0 22h00'],
      ['INFO', 'Mise \u00e0 jour termin\u00e9e', 'Le service de notifications a \u00e9t\u00e9 mis \u00e0 jour avec succ\u00e8s'],
    ];
    for (const [severity, title, message] of alerts) {
      await pool.query(
        'INSERT INTO notifications (type, title, message, severity) VALUES ($1, $2, $3, $4)',
        ['system.alert', title, message, severity]
      );
    }
    console.log('31 notifications de demonstration ajoutees');
  } finally {
    await pool.end();
  }
})();
