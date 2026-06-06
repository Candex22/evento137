const pool = require('../config/db');

// Catálogo: cada producto con su stock efectivo y sus gustos.
// Si tiene_gustos, el stock es la SUMA de los gustos; si no, es el stock propio.
async function getProductos(req, res) {
  try {
    const result = await pool.query(
      `SELECT p.id_producto, p.nombre, p.precio, p.tiene_gustos,
              CASE WHEN p.tiene_gustos
                THEN COALESCE((SELECT SUM(g.stock) FROM gusto g WHERE g.id_producto = p.id_producto), 0)
                ELSE p.stock
              END AS stock,
              COALESCE(
                (SELECT json_agg(json_build_object('id_gusto', g.id_gusto, 'nombre', g.nombre, 'stock', g.stock) ORDER BY g.nombre)
                 FROM gusto g WHERE g.id_producto = p.id_producto), '[]'
              ) AS gustos
       FROM producto p
       ORDER BY p.nombre ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar productos:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

async function getProductosAdmin(req, res) {
  try {
    const result = await pool.query(
      `SELECT p.id_producto, p.nombre, p.tiene_gustos, p.precio,
              CASE WHEN p.tiene_gustos
                THEN COALESCE((SELECT SUM(g.stock) FROM gusto g WHERE g.id_producto = p.id_producto), 0)
                ELSE p.stock END AS stock,
              CASE WHEN p.tiene_gustos
                THEN COALESCE((SELECT SUM(g.total_ingresado) FROM gusto g WHERE g.id_producto = p.id_producto), 0)
                ELSE p.total_ingresado END AS total_ingresado
       FROM producto p
       ORDER BY p.nombre ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar productos (admin):', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// POST /api/buffet/productos — crea un producto (con o sin gustos)
async function crearProducto(req, res) {
  const nombre = (req.body.nombre || '').trim();
  const precio = Number(req.body.precio) || 0;
  const tiene_gustos = req.body.tiene_gustos === true || req.body.tiene_gustos === 'true';
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });
  if (precio < 0) return res.status(400).json({ error: 'El precio no puede ser negativo.' });
  try {
    const r = await pool.query(
      `INSERT INTO producto (nombre, precio, tiene_gustos, stock, total_ingresado)
       VALUES ($1, $2, $3, 0, 0)
       RETURNING id_producto, nombre, precio, tiene_gustos`,
      [nombre, precio, tiene_gustos]
    );
    res.status(201).json({ message: `Producto "${nombre}" creado.`, producto: r.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un producto con ese nombre.' });
    console.error('Error al crear producto:', err);
    res.status(500).json({ error: 'Error al crear el producto.' });
  }
}

// POST /api/buffet/productos/:id/gustos — agrega un gusto (con stock inicial opcional)
async function agregarGusto(req, res) {
  const id_producto = parseInt(req.params.id, 10);
  const nombre = (req.body.nombre || '').trim();
  const stock = parseInt(req.body.stock, 10) || 0;
  if (isNaN(id_producto)) return res.status(400).json({ error: 'ID de producto inválido.' });
  if (!nombre) return res.status(400).json({ error: 'El nombre del gusto es obligatorio.' });
  if (stock < 0) return res.status(400).json({ error: 'El stock no puede ser negativo.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const prod = await client.query('SELECT id_producto FROM producto WHERE id_producto = $1 FOR UPDATE', [id_producto]);
    if (prod.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Producto no encontrado.' }); }

    await client.query('UPDATE producto SET tiene_gustos = TRUE WHERE id_producto = $1', [id_producto]);
    const g = await client.query(
      `INSERT INTO gusto (id_producto, nombre, stock, total_ingresado)
       VALUES ($1, $2, $3, $3) RETURNING id_gusto, nombre, stock`,
      [id_producto, nombre, stock]
    );
    if (stock > 0) {
      await client.query(
        `INSERT INTO movimiento_stock (id_producto, id_usuario, tipo, cantidad) VALUES ($1, $2, 'ingreso', $3)`,
        [id_producto, req.session.id_usuario, stock]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ message: `Gusto "${nombre}" agregado.`, gusto: g.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Ese gusto ya existe en el producto.' });
    console.error('Error al agregar gusto:', err);
    res.status(500).json({ error: 'Error al agregar el gusto.' });
  } finally {
    client.release();
  }
}

// POST /api/buffet/ingresos — carga stock a un producto (sin gustos) o a un gusto
async function cargarStock(req, res) {
  const id_gusto = req.body.id_gusto != null ? parseInt(req.body.id_gusto, 10) : null;
  const id_producto = req.body.id_producto != null ? parseInt(req.body.id_producto, 10) : null;
  const cantidad = parseInt(req.body.cantidad, 10);
  if (isNaN(cantidad) || cantidad <= 0) return res.status(400).json({ error: 'La cantidad debe ser mayor a 0.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (id_gusto != null && !isNaN(id_gusto)) {
      const g = await client.query(
        `UPDATE gusto SET stock = stock + $1, total_ingresado = total_ingresado + $1
         WHERE id_gusto = $2 RETURNING id_producto, nombre, stock`,
        [cantidad, id_gusto]
      );
      if (g.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Gusto no encontrado.' }); }
      await client.query(
        `INSERT INTO movimiento_stock (id_producto, id_usuario, tipo, cantidad) VALUES ($1, $2, 'ingreso', $3)`,
        [g.rows[0].id_producto, req.session.id_usuario, cantidad]
      );
      await client.query('COMMIT');
      return res.json({ message: `+${cantidad} a "${g.rows[0].nombre}". Stock: ${g.rows[0].stock}.` });
    }
    if (id_producto == null || isNaN(id_producto)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Falta el producto o el gusto.' }); }
    const p = await client.query(
      `UPDATE producto SET stock = stock + $1, total_ingresado = total_ingresado + $1
       WHERE id_producto = $2 AND tiene_gustos = FALSE RETURNING nombre, stock`,
      [cantidad, id_producto]
    );
    if (p.rowCount === 0) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'El producto no existe o tiene gustos (cargá el stock al gusto).' }); }
    await client.query(
      `INSERT INTO movimiento_stock (id_producto, id_usuario, tipo, cantidad) VALUES ($1, $2, 'ingreso', $3)`,
      [id_producto, req.session.id_usuario, cantidad]
    );
    await client.query('COMMIT');
    res.json({ message: `+${cantidad} a "${p.rows[0].nombre}". Stock: ${p.rows[0].stock}.` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al cargar stock:', err);
    res.status(500).json({ error: 'Error al cargar el stock.' });
  } finally {
    client.release();
  }
}

// Helper de ajuste +/- (flechitas). entidad: 'producto' | 'gusto'
async function ajustar(entidad, id, delta, idUsuario, res) {
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });
  if (isNaN(delta) || delta === 0) return res.status(400).json({ error: 'El ajuste debe ser distinto de 0.' });

  const tabla = entidad === 'gusto' ? 'gusto' : 'producto';
  const pk = entidad === 'gusto' ? 'id_gusto' : 'id_producto';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query(`SELECT * FROM ${tabla} WHERE ${pk} = $1 FOR UPDATE`, [id]);
    if (cur.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'No encontrado.' }); }
    if (cur.rows[0].stock + delta < 0) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'El stock no puede quedar negativo.' }); }

    const tipo = delta > 0 ? 'ingreso' : 'ajuste';
    if (delta > 0) {
      await client.query(`UPDATE ${tabla} SET stock = stock + $1, total_ingresado = total_ingresado + $1 WHERE ${pk} = $2`, [delta, id]);
    } else {
      await client.query(`UPDATE ${tabla} SET stock = stock + $1 WHERE ${pk} = $2`, [delta, id]);
    }
    const idProd = entidad === 'gusto' ? cur.rows[0].id_producto : id;
    await client.query(
      `INSERT INTO movimiento_stock (id_producto, id_usuario, tipo, cantidad) VALUES ($1, $2, $3, $4)`,
      [idProd, idUsuario, tipo, Math.abs(delta)]
    );
    await client.query('COMMIT');
    res.json({ message: 'Stock actualizado.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al ajustar stock:', err);
    res.status(500).json({ error: 'Error al ajustar el stock.' });
  } finally {
    client.release();
  }
}

function ajustarStock(req, res) {
  return ajustar('producto', parseInt(req.params.id, 10), parseInt(req.body.delta, 10), req.session.id_usuario, res);
}
function ajustarGusto(req, res) {
  return ajustar('gusto', parseInt(req.params.id, 10), parseInt(req.body.delta, 10), req.session.id_usuario, res);
}

// PATCH /api/buffet/productos/:id/precio
async function actualizarPrecio(req, res) {
  const id = parseInt(req.params.id, 10);
  const precio = Number(req.body.precio);
  if (isNaN(id)) return res.status(400).json({ error: 'ID de producto inválido.' });
  if (isNaN(precio) || precio < 0) return res.status(400).json({ error: 'El precio debe ser mayor o igual a 0.' });
  try {
    const r = await pool.query(
      'UPDATE producto SET precio = $1 WHERE id_producto = $2 RETURNING id_producto, nombre, precio',
      [precio, id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json({ message: `Precio de "${r.rows[0].nombre}" actualizado.`, producto: r.rows[0] });
  } catch (err) {
    console.error('Error al actualizar precio:', err);
    res.status(500).json({ error: 'Error al actualizar el precio.' });
  }
}

// GET /api/admin/movimientos
async function getMovimientos(req, res) {
  try {
    const result = await pool.query(
      `SELECT m.id_movimiento, m.cantidad, m.tipo, m.created_at,
              p.nombre AS producto, u.name_user AS usuario
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

module.exports = {
  getProductos, getProductosAdmin, crearProducto, agregarGusto,
  cargarStock, ajustarStock, ajustarGusto, actualizarPrecio, getMovimientos,
};