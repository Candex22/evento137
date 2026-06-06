const pool = require('../config/db');

// GET /api/buffet/productos — stock actual de todos los productos
async function getProductos(req, res) {
  try {
    const result = await pool.query(
      'SELECT id_producto, nombre, stock, total_ingresado, precio, created_at FROM producto ORDER BY nombre ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar productos:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// POST /api/buffet/ingresos — carga un ingreso de stock
// Si el producto existe (mismo nombre, sin importar mayúsculas) suma; si no, lo crea.
// Registra el movimiento en el historial. Todo dentro de una transacción.
async function crearIngreso(req, res) {
  const nombre = (req.body.nombre || '').trim();
  const cantidad = parseInt(req.body.cantidad, 10);

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre del producto es obligatorio.' });
  }
  if (isNaN(cantidad) || cantidad <= 0) {
    return res.status(400).json({ error: 'La cantidad debe ser un número mayor a 0.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert: inserta o suma al stock existente.
    // (xmax = 0) indica si la fila fue recién insertada (true) o actualizada (false).
    const prod = await client.query(
      `INSERT INTO producto (nombre, stock, total_ingresado)
       VALUES ($1, $2, $2)
       ON CONFLICT (lower(nombre))
       DO UPDATE SET stock = producto.stock + EXCLUDED.stock,
                     total_ingresado = producto.total_ingresado + EXCLUDED.total_ingresado
       RETURNING id_producto, nombre, stock, total_ingresado, (xmax = 0) AS creado`,
      [nombre, cantidad]
    );
    const p = prod.rows[0];

    // Registra el movimiento (quién, cuánto, cuándo)
    await client.query(
      `INSERT INTO movimiento_stock (id_producto, id_usuario, tipo, cantidad)
       VALUES ($1, $2, 'ingreso', $3)`,
      [p.id_producto, req.session.id_usuario, cantidad]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: p.creado
        ? `Producto "${p.nombre}" creado con ${cantidad} unidades.`
        : `+${cantidad} a "${p.nombre}". Stock actual: ${p.stock}.`,
      producto: p,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al cargar ingreso:', err);
    res.status(500).json({ error: 'Error al cargar el ingreso.' });
  } finally {
    client.release();
  }
}

// PATCH /api/buffet/productos/:id/ajuste — ajusta el stock de a pasos (flechitas)
// delta > 0 cuenta como ingreso (sube disponible y total).
// delta < 0 cuenta como ajuste (baja disponible, NO toca el total). No deja negativo.
async function ajustarStock(req, res) {
  const id = parseInt(req.params.id, 10);
  const delta = parseInt(req.body.delta, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID de producto inválido.' });
  }
  if (isNaN(delta) || delta === 0) {
    return res.status(400).json({ error: 'El ajuste debe ser distinto de 0.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cur = await client.query(
      'SELECT id_producto, nombre, stock, total_ingresado FROM producto WHERE id_producto = $1 FOR UPDATE',
      [id]
    );
    if (cur.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    const p = cur.rows[0];

    if (p.stock + delta < 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'El stock no puede quedar negativo.' });
    }

    const tipo = delta > 0 ? 'ingreso' : 'ajuste';

    // El total solo sube con ingresos; los ajustes (bajas) no lo modifican.
    const upd = delta > 0
      ? await client.query(
          `UPDATE producto SET stock = stock + $1, total_ingresado = total_ingresado + $1
           WHERE id_producto = $2
           RETURNING id_producto, nombre, stock, total_ingresado`,
          [delta, id]
        )
      : await client.query(
          `UPDATE producto SET stock = stock + $1
           WHERE id_producto = $2
           RETURNING id_producto, nombre, stock, total_ingresado`,
          [delta, id]
        );

    await client.query(
      `INSERT INTO movimiento_stock (id_producto, id_usuario, tipo, cantidad)
       VALUES ($1, $2, $3, $4)`,
      [id, req.session.id_usuario, tipo, Math.abs(delta)]
    );

    await client.query('COMMIT');
    res.json({ message: 'Stock actualizado.', producto: upd.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al ajustar stock:', err);
    res.status(500).json({ error: 'Error al ajustar el stock.' });
  } finally {
    client.release();
  }
}

// GET /api/buffet/movimientos — historial de los últimos movimientos
async function getMovimientos(req, res) {
  try {
    const result = await pool.query(
      `SELECT m.id_movimiento, m.cantidad, m.tipo, m.created_at,
              p.nombre AS producto,
              u.name_user AS usuario
       FROM movimiento_stock m
       JOIN producto p ON p.id_producto = m.id_producto
       LEFT JOIN usuario u ON u.id_user = m.id_usuario
       ORDER BY m.created_at DESC
       LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar movimientos:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// PATCH /api/cajero/productos/:id/precio — el cajero fija el precio de un producto
async function actualizarPrecio(req, res) {
  const id = parseInt(req.params.id, 10);
  const precio = Number(req.body.precio);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID de producto inválido.' });
  }
  if (isNaN(precio) || precio < 0) {
    return res.status(400).json({ error: 'El precio debe ser un número mayor o igual a 0.' });
  }

  try {
    const r = await pool.query(
      'UPDATE producto SET precio = $1 WHERE id_producto = $2 RETURNING id_producto, nombre, precio',
      [precio, id]
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    res.json({ message: `Precio de "${r.rows[0].nombre}" actualizado.`, producto: r.rows[0] });
  } catch (err) {
    console.error('Error al actualizar precio:', err);
    res.status(500).json({ error: 'Error al actualizar el precio.' });
  }
}

module.exports = { getProductos, crearIngreso, ajustarStock, getMovimientos, actualizarPrecio };