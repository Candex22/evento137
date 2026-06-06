const pool = require('../config/db');

async function listar(soloActivos) {
  const filtro = soloActivos ? 'WHERE c.activo = TRUE' : '';
  const r = await pool.query(
    `SELECT c.id_combo, c.nombre, c.precio, c.activo,
            COALESCE(
              json_agg(json_build_object(
                'id_producto', p.id_producto,
                'producto', p.nombre,
                'cantidad', ci.cantidad,
                'tiene_gustos', p.tiene_gustos,
                'gustos', COALESCE(
                  (SELECT json_agg(json_build_object('id_gusto', g.id_gusto, 'nombre', g.nombre, 'stock', g.stock) ORDER BY g.nombre)
                   FROM gusto g WHERE g.id_producto = p.id_producto), '[]')
              ) ORDER BY p.nombre) FILTER (WHERE ci.id_combo_item IS NOT NULL), '[]'
            ) AS componentes
     FROM combo c
     LEFT JOIN combo_item ci ON ci.id_combo = c.id_combo
     LEFT JOIN producto p ON p.id_producto = ci.id_producto
     ${filtro}
     GROUP BY c.id_combo
     ORDER BY c.nombre ASC`
  );
  return r.rows;
}

async function getCombosAdmin(req, res) {
  try { res.json(await listar(false)); }
  catch (err) { console.error('Error al listar combos:', err); res.status(500).json({ error: 'Error interno del servidor.' }); }
}

async function getCombosMozo(req, res) {
  try { res.json(await listar(true)); }
  catch (err) { console.error('Error al listar combos (mozo):', err); res.status(500).json({ error: 'Error interno del servidor.' }); }
}

function limpiarItems(items) {
  return (Array.isArray(items) ? items : [])
    .map(i => ({ id_producto: parseInt(i.id_producto, 10), cantidad: parseInt(i.cantidad, 10) }))
    .filter(i => !isNaN(i.id_producto) && !isNaN(i.cantidad) && i.cantidad > 0);
}

async function crearCombo(req, res) {
  const nombre = (req.body.nombre || '').trim();
  const precio = Number(req.body.precio);
  const items = limpiarItems(req.body.items);
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });
  if (isNaN(precio) || precio < 0) return res.status(400).json({ error: 'El precio debe ser mayor o igual a 0.' });
  if (items.length === 0) return res.status(400).json({ error: 'Agregá al menos un producto al combo.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const c = await client.query('INSERT INTO combo (nombre, precio) VALUES ($1, $2) RETURNING id_combo', [nombre, precio]);
    const id_combo = c.rows[0].id_combo;
    for (const it of items) {
      await client.query('INSERT INTO combo_item (id_combo, id_producto, cantidad) VALUES ($1, $2, $3)', [id_combo, it.id_producto, it.cantidad]);
    }
    await client.query('COMMIT');
    res.status(201).json({ message: `Combo "${nombre}" creado.`, id_combo });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al crear combo:', err);
    res.status(500).json({ error: 'Error al crear el combo.' });
  } finally { client.release(); }
}

async function actualizarCombo(req, res) {
  const id = parseInt(req.params.id, 10);
  const nombre = (req.body.nombre || '').trim();
  const precio = Number(req.body.precio);
  const activo = req.body.activo !== false;
  const items = limpiarItems(req.body.items);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });
  if (isNaN(precio) || precio < 0) return res.status(400).json({ error: 'El precio debe ser mayor o igual a 0.' });
  if (items.length === 0) return res.status(400).json({ error: 'El combo debe tener al menos un producto.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const upd = await client.query('UPDATE combo SET nombre = $1, precio = $2, activo = $3 WHERE id_combo = $4 RETURNING id_combo', [nombre, precio, activo, id]);
    if (upd.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Combo no encontrado.' }); }
    await client.query('DELETE FROM combo_item WHERE id_combo = $1', [id]);
    for (const it of items) {
      await client.query('INSERT INTO combo_item (id_combo, id_producto, cantidad) VALUES ($1, $2, $3)', [id, it.id_producto, it.cantidad]);
    }
    await client.query('COMMIT');
    res.json({ message: 'Combo actualizado.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar combo:', err);
    res.status(500).json({ error: 'Error al actualizar el combo.' });
  } finally { client.release(); }
}

async function eliminarCombo(req, res) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });
  try {
    const r = await pool.query('DELETE FROM combo WHERE id_combo = $1 RETURNING id_combo', [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Combo no encontrado.' });
    res.json({ message: 'Combo eliminado.' });
  } catch (err) { console.error('Error al eliminar combo:', err); res.status(500).json({ error: 'Error al eliminar el combo.' }); }
}

module.exports = { getCombosAdmin, getCombosMozo, crearCombo, actualizarCombo, eliminarCombo };