const express = require('express');
const { Pool } = require('pg');
const cors    = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// ─── CONFIGURA TU BASE DE DATOS AQUÍ ───────────────────────
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
// ────────────────────────────────────────────────────────────
db.connect()
  .then(() => console.log('Base de datos conectada ✓'))
  .catch(err => console.error('Error conectando BD:', err));
// Prueba de conexión con la BD
app.get('/ping', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'OK', mensaje: 'Servidor y base de datos funcionando ✓' });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo conectar a la BD', detalle: err.message });
  }
});
app.post('/respuestas', async (req, res) => {
  const { id_encuesta, respuestas } = req.body;

  // Validación básica
  if (!id_encuesta || !Array.isArray(respuestas) || respuestas.length === 0) {
    return res.status(400).json({ error: 'Datos incompletos.' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 1. Crear sesión (una persona completó la encuesta)
    const sesion = await client.query(
      'INSERT INTO sesiones_respuesta (id_encuesta) VALUES ($1) RETURNING id_sesion',
      [id_encuesta]
    );
    const id_sesion = sesion.rows[0].id_sesion;

    // 2. Guardar cada respuesta
    for (const r of respuestas) {
      await client.query(
        'INSERT INTO respuestas (id_sesion, id_pregunta, id_opcion) VALUES ($1, $2, $3)',
        [id_sesion, r.id_pregunta, r.id_opcion]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ mensaje: 'Respuestas guardadas correctamente.', id_sesion });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al guardar las respuestas.' });
  } finally {
    client.release();
  }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});