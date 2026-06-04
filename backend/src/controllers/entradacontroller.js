const pool = require('../config/db');

// GET /api/entradas/estado — resumen para el contador en tiempo real
async function getEstado(req, res) {
  try {
    const r = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM entrada)                  AS total_entradas,
        (SELECT COUNT(*) FROM entrada WHERE ingresada)  AS ingresadas,
        (SELECT extra FROM evento_contador WHERE id = 1) AS extra
    `);
    const row = r.rows[0];
    const total_entradas = parseInt(row.total_entradas, 10);
    const ingresadas     = parseInt(row.ingresadas, 10);
    const extra          = parseInt(row.extra ?? 0, 10);
    res.json({
      total_entradas,
      ingresadas,
      disponibles: total_entradas - ingresadas,
      extra,
      total_personas: ingresadas + extra,
    });
  } catch (err) {
    console.error('Error al obtener estado de entradas:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// GET /api/entradas/lista — todas las entradas (grilla + detalle del admin)
async function getLista(req, res) {
  try {
    const r = await pool.query(
      'SELECT numero, ingresada, ingresada_at FROM entrada ORDER BY numero ASC'
    );
    res.json(r.rows);
  } catch (err) {
    console.error('Error al listar entradas:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// POST /api/entradas/generar — genera un rango de entradas (aditivo, no pisa)
async function generar(req, res) {
  const desde = parseInt(req.body.desde, 10);
  const hasta = parseInt(req.body.hasta, 10);
  if (isNaN(desde) || isNaN(hasta) || desde < 1 || hasta < desde) {
    return res.status(400).json({ error: 'Rango inválido.' });
  }
  if (hasta - desde + 1 > 20000) {
    return res.status(400).json({ error: 'El rango es demasiado grande (máx. 20000).' });
  }
  try {
    await pool.query(
      'INSERT INTO entrada (numero) SELECT generate_series($1::int, $2::int) ON CONFLICT (numero) DO NOTHING',
      [desde, hasta]
    );
    res.json({ message: `Entradas ${desde}–${hasta} cargadas.` });
  } catch (err) {
    console.error('Error al generar entradas:', err);
    res.status(500).json({ error: 'Error al generar las entradas.' });
  }
}

// PATCH /api/entradas/:numero/tachar — marca una entrada como ingresada
async function tachar(req, res) {
  const numero = parseInt(req.params.numero, 10);
  if (isNaN(numero)) return res.status(400).json({ error: 'Número inválido.' });
  try {
    const r = await pool.query(
      `UPDATE entrada SET ingresada = true, ingresada_at = NOW(), id_usuario = $1
       WHERE numero = $2 AND ingresada = false RETURNING numero`,
      [req.session.id_usuario, numero]
    );
    if (r.rowCount === 0) {
      const ex = await pool.query('SELECT ingresada FROM entrada WHERE numero = $1', [numero]);
      if (ex.rowCount === 0) return res.status(404).json({ error: `La entrada ${numero} no existe en la lista.` });
      return res.status(409).json({ error: `La entrada ${numero} ya había ingresado.` });
    }
    res.json({ message: `Entrada ${numero} ingresada.` });
  } catch (err) {
    console.error('Error al tachar entrada:', err);
    res.status(500).json({ error: 'Error al registrar la entrada.' });
  }
}

// POST /api/entradas/contador — ajusta el contador manual (no baja de 0)
async function ajustarContador(req, res) {
  const delta = parseInt(req.body.delta, 10);
  if (isNaN(delta)) return res.status(400).json({ error: 'Delta inválido.' });
  try {
    const r = await pool.query(
      'UPDATE evento_contador SET extra = GREATEST(extra + $1, 0) WHERE id = 1 RETURNING extra',
      [delta]
    );
    res.json({ extra: r.rows[0].extra });
  } catch (err) {
    console.error('Error al ajustar contador:', err);
    res.status(500).json({ error: 'Error al ajustar el contador.' });
  }
}

module.exports = { getEstado, getLista, generar, tachar, ajustarContador };