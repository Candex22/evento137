const pool = require('../config/db');

// POST /api/mozo/pedidos — el mozo arma Y confirma el pedido.
// Valida stock y descuenta en el acto. Si falta algo, cancela todo y avisa.
// items: [{ id_producto, cantidad, gustos?: [{ id_gusto, cantidad }] }]
async function crearPedido(req, res) {
  const nombre = (req.body.nombre || '').trim();
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!nombre) return res.status(400).json({ error: 'El nombre del pedido es obligatorio.' });
  if (items.length === 0) return res.status(400).json({ error: 'Agregá al menos un producto.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const faltantes = [];
    const aDescontar = [];

    for (const raw of items) {
      const id_producto = parseInt(raw.id_producto, 10);
      if (isNaN(id_producto)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Producto inválido.' }); }

      const prod = await client.query(
        'SELECT id_producto, nombre, precio, tiene_gustos, stock FROM producto WHERE id_producto = $1 FOR UPDATE',
        [id_producto]
      );
      if (prod.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: `Producto ${id_producto} no existe.` }); }
      const P = prod.rows[0];

      if (P.tiene_gustos) {
        const gustos = (Array.isArray(raw.gustos) ? raw.gustos : [])
          .map(g => ({ id_gusto: parseInt(g.id_gusto, 10), cantidad: parseInt(g.cantidad, 10) }))
          .filter(g => !isNaN(g.id_gusto) && !isNaN(g.cantidad) && g.cantidad > 0);
        if (gustos.length === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: `Elegí gustos para "${P.nombre}".` }); }

        const totalGustos = gustos.reduce((s, g) => s + g.cantidad, 0);
        const totalItem = parseInt(raw.cantidad, 10);
        if (!isNaN(totalItem) && totalItem !== totalGustos) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Los gustos de "${P.nombre}" deben sumar ${totalItem}.` });
        }

        for (const g of gustos) {
          const gr = await client.query(
            'SELECT nombre, stock FROM gusto WHERE id_gusto = $1 AND id_producto = $2 FOR UPDATE',
            [g.id_gusto, id_producto]
          );
          if (gr.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Gusto inválido.' }); }
          if (g.cantidad > gr.rows[0].stock) faltantes.push(`${P.nombre} - ${gr.rows[0].nombre} (pide ${g.cantidad}, hay ${gr.rows[0].stock})`);
          aDescontar.push({ id_producto, id_gusto: g.id_gusto, cantidad: g.cantidad, precio: P.precio });
        }
      } else {
        const cantidad = parseInt(raw.cantidad, 10);
        if (isNaN(cantidad) || cantidad <= 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: `Cantidad inválida para "${P.nombre}".` }); }
        if (cantidad > P.stock) faltantes.push(`${P.nombre} (pide ${cantidad}, hay ${P.stock})`);
        aDescontar.push({ id_producto, id_gusto: null, cantidad, precio: P.precio });
      }
    }

    if (faltantes.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Sin stock, pedido cancelado: ${faltantes.join(', ')}.` });
    }

    const ped = await client.query(
      `INSERT INTO pedido (nombre, id_mozo, estado, resolved_at) VALUES ($1, $2, 'confirmado', NOW()) RETURNING id_pedido`,
      [nombre, req.session.id_usuario]
    );
    const id_pedido = ped.rows[0].id_pedido;

    for (const d of aDescontar) {
      if (d.id_gusto != null) {
        await client.query('UPDATE gusto SET stock = stock - $1 WHERE id_gusto = $2', [d.cantidad, d.id_gusto]);
      } else {
        await client.query('UPDATE producto SET stock = stock - $1 WHERE id_producto = $2', [d.cantidad, d.id_producto]);
      }
      await client.query(
        `INSERT INTO pedido_item (id_pedido, id_producto, id_gusto, cantidad, precio_unitario) VALUES ($1, $2, $3, $4, $5)`,
        [id_pedido, d.id_producto, d.id_gusto, d.cantidad, d.precio]
      );
      await client.query(
        `INSERT INTO movimiento_stock (id_producto, id_usuario, tipo, cantidad) VALUES ($1, $2, 'egreso', $3)`,
        [d.id_producto, req.session.id_usuario, d.cantidad]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Pedido confirmado.', id_pedido });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al crear pedido:', err);
    res.status(500).json({ error: 'Error al crear el pedido.' });
  } finally {
    client.release();
  }
}

const ITEMS_JSON = `
  COALESCE(
    json_agg(json_build_object(
      'producto', pr.nombre, 'gusto', g.nombre, 'cantidad', pi.cantidad,
      'precio_unitario', pi.precio_unitario, 'subtotal', pi.cantidad * pi.precio_unitario
    ) ORDER BY pr.nombre) FILTER (WHERE pi.id_item IS NOT NULL), '[]'
  ) AS items,
  COALESCE(SUM(pi.cantidad * pi.precio_unitario), 0) AS total`;

async function misPedidos(req, res) {
  try {
    const r = await pool.query(
      `SELECT p.id_pedido, p.nombre, p.estado, p.pagado, p.pagado_at, p.created_at, ${ITEMS_JSON}
       FROM pedido p
       LEFT JOIN pedido_item pi ON pi.id_pedido = p.id_pedido
       LEFT JOIN producto pr ON pr.id_producto = pi.id_producto
       LEFT JOIN gusto g ON g.id_gusto = pi.id_gusto
       WHERE p.id_mozo = $1
       GROUP BY p.id_pedido
       ORDER BY p.created_at DESC
       LIMIT 50`,
      [req.session.id_usuario]
    );
    res.json(r.rows);
  } catch (err) {
    console.error('Error al listar pedidos del mozo:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

async function porCobrar(req, res) {
  try {
    const r = await pool.query(
      `SELECT p.id_pedido, p.nombre, p.created_at,
              u.nombre AS mozo_nombre, u.apellido AS mozo_apellido, ${ITEMS_JSON}
       FROM pedido p
       JOIN usuario u ON u.id_user = p.id_mozo
       LEFT JOIN pedido_item pi ON pi.id_pedido = p.id_pedido
       LEFT JOIN producto pr ON pr.id_producto = pi.id_producto
       LEFT JOIN gusto g ON g.id_gusto = pi.id_gusto
       WHERE p.estado = 'confirmado' AND p.pagado = FALSE
       GROUP BY p.id_pedido, u.nombre, u.apellido
       ORDER BY p.created_at ASC`
    );
    res.json(r.rows);
  } catch (err) {
    console.error('Error al listar por cobrar:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

async function marcarPagado(req, res) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });
  try {
    const r = await pool.query(
      `UPDATE pedido SET pagado = TRUE, pagado_at = NOW(), id_cajero = $1
       WHERE id_pedido = $2 AND estado = 'confirmado' AND pagado = FALSE RETURNING id_pedido`,
      [req.session.id_usuario, id]
    );
    if (r.rowCount === 0) return res.status(409).json({ error: 'El pedido no está para cobrar (no existe o ya está pagado).' });
    res.json({ message: 'Pago registrado.' });
  } catch (err) {
    console.error('Error al marcar pagado:', err);
    res.status(500).json({ error: 'Error al registrar el pago.' });
  }
}

async function historialCajero(req, res) {
  try {
    const r = await pool.query(
      `SELECT p.id_pedido, p.nombre, p.created_at, p.pagado_at,
              m.nombre AS mozo_nombre, m.apellido AS mozo_apellido, ${ITEMS_JSON}
       FROM pedido p
       JOIN usuario m ON m.id_user = p.id_mozo
       LEFT JOIN pedido_item pi ON pi.id_pedido = p.id_pedido
       LEFT JOIN producto pr ON pr.id_producto = pi.id_producto
       LEFT JOIN gusto g ON g.id_gusto = pi.id_gusto
       WHERE p.pagado = TRUE AND p.id_cajero = $1
       GROUP BY p.id_pedido, m.nombre, m.apellido
       ORDER BY p.pagado_at DESC
       LIMIT 100`,
      [req.session.id_usuario]
    );
    res.json(r.rows);
  } catch (err) {
    console.error('Error al listar historial (cajero):', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

async function historialAdmin(req, res) {
  try {
    const r = await pool.query(
      `SELECT p.id_pedido, p.nombre, p.estado, p.pagado, p.pagado_at, p.created_at,
              m.nombre AS mozo_nombre, m.apellido AS mozo_apellido,
              c.nombre AS cajero_nombre, c.apellido AS cajero_apellido, ${ITEMS_JSON}
       FROM pedido p
       JOIN usuario m ON m.id_user = p.id_mozo
       LEFT JOIN usuario c ON c.id_user = p.id_cajero
       LEFT JOIN pedido_item pi ON pi.id_pedido = p.id_pedido
       LEFT JOIN producto pr ON pr.id_producto = pi.id_producto
       LEFT JOIN gusto g ON g.id_gusto = pi.id_gusto
       WHERE p.estado = 'confirmado'
       GROUP BY p.id_pedido, m.nombre, m.apellido, c.nombre, c.apellido
       ORDER BY p.created_at DESC
       LIMIT 200`
    );
    res.json(r.rows);
  } catch (err) {
    console.error('Error al listar historial (admin):', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

module.exports = { crearPedido, misPedidos, porCobrar, marcarPagado, historialCajero, historialAdmin };