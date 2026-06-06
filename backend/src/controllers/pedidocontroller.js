const pool = require('../config/db');

async function crearPedido(req, res) {
  const nombre = (req.body.nombre || '').trim();
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const metodo = req.body.metodo_pago;
  const recibidoRaw = req.body.recibido;
  if (!nombre) return res.status(400).json({ error: 'El nombre del pedido es obligatorio.' });
  if (items.length === 0) return res.status(400).json({ error: 'Agregá al menos un producto.' });
  if (!['efectivo', 'transferencia'].includes(metodo)) return res.status(400).json({ error: 'Elegí un método de pago.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const faltantes = [];
    const aDescontar = [];
    const lineas = [];
    let total = 0;

    async function resolverComponente(idProducto, cantidadNecesaria, gustosElegidos, etiquetaCombo) {
      const prod = await client.query('SELECT nombre, tiene_gustos, stock FROM producto WHERE id_producto = $1 FOR UPDATE', [idProducto]);
      if (prod.rowCount === 0) throw { http: 404, msg: `Producto ${idProducto} no existe.` };
      const P = prod.rows[0];
      const pref = etiquetaCombo ? `${etiquetaCombo} → ` : '';
      const partes = [];
      if (P.tiene_gustos) {
        const gs = (Array.isArray(gustosElegidos) ? gustosElegidos : [])
          .map(g => ({ id_gusto: parseInt(g.id_gusto, 10), cantidad: parseInt(g.cantidad, 10) }))
          .filter(g => !isNaN(g.id_gusto) && !isNaN(g.cantidad) && g.cantidad > 0);
        const suma = gs.reduce((s, g) => s + g.cantidad, 0);
        if (suma !== cantidadNecesaria) throw { http: 400, msg: `Los gustos de "${P.nombre}" deben sumar ${cantidadNecesaria}.` };
        for (const g of gs) {
          const gr = await client.query('SELECT nombre, stock FROM gusto WHERE id_gusto = $1 AND id_producto = $2 FOR UPDATE', [g.id_gusto, idProducto]);
          if (gr.rowCount === 0) throw { http: 404, msg: 'Gusto inválido.' };
          if (g.cantidad > gr.rows[0].stock) faltantes.push(`${pref}${P.nombre} - ${gr.rows[0].nombre} (pide ${g.cantidad}, hay ${gr.rows[0].stock})`);
          aDescontar.push({ id_gusto: g.id_gusto, id_producto: idProducto, cantidad: g.cantidad });
          partes.push(`${g.cantidad} ${gr.rows[0].nombre}`);
        }
      } else {
        if (cantidadNecesaria > P.stock) faltantes.push(`${pref}${P.nombre} (pide ${cantidadNecesaria}, hay ${P.stock})`);
        aDescontar.push({ id_gusto: null, id_producto: idProducto, cantidad: cantidadNecesaria });
      }
      return { nombre: P.nombre, detalle: partes.length ? `${P.nombre}: ${partes.join(', ')}` : null };
    }

    for (const raw of items) {
      if (raw.id_combo != null) {
        const id_combo = parseInt(raw.id_combo, 10);
        const cantCombos = parseInt(raw.cantidad, 10);
        if (isNaN(id_combo) || isNaN(cantCombos) || cantCombos <= 0) throw { http: 400, msg: 'Combo inválido.' };
        const c = await client.query('SELECT nombre, precio, activo FROM combo WHERE id_combo = $1', [id_combo]);
        if (c.rowCount === 0) throw { http: 404, msg: 'Combo no existe.' };
        if (!c.rows[0].activo) throw { http: 409, msg: `El combo "${c.rows[0].nombre}" no está disponible.` };
        const comps = await client.query('SELECT id_producto, cantidad FROM combo_item WHERE id_combo = $1', [id_combo]);
        const gpc = raw.gustos_por_componente || {};
        const detalles = [];
        for (const comp of comps.rows) {
          const necesita = comp.cantidad * cantCombos;
          const r = await resolverComponente(comp.id_producto, necesita, gpc[comp.id_producto], c.rows[0].nombre);
          if (r.detalle) detalles.push(r.detalle);
        }
        total += Number(c.rows[0].precio) * cantCombos;
        lineas.push({ id_combo, cantidad: cantCombos, precio: c.rows[0].precio, detalle: detalles.join(' · ') || null });
        continue;
      }
      const id_producto = parseInt(raw.id_producto, 10);
      if (isNaN(id_producto)) throw { http: 400, msg: 'Producto inválido.' };
      const prodInfo = await client.query('SELECT precio, tiene_gustos FROM producto WHERE id_producto = $1', [id_producto]);
      if (prodInfo.rowCount === 0) throw { http: 404, msg: `Producto ${id_producto} no existe.` };
      const cantidad = prodInfo.rows[0].tiene_gustos
        ? (Array.isArray(raw.gustos) ? raw.gustos : []).reduce((s, g) => s + (parseInt(g.cantidad, 10) || 0), 0)
        : parseInt(raw.cantidad, 10);
      if (isNaN(cantidad) || cantidad <= 0) throw { http: 400, msg: 'Cantidad inválida.' };
      await resolverComponente(id_producto, cantidad, raw.gustos, null);
      const precio = Number(prodInfo.rows[0].precio);
      if (prodInfo.rows[0].tiene_gustos) {
        for (const g of (raw.gustos || [])) {
          const idg = parseInt(g.id_gusto, 10), cant = parseInt(g.cantidad, 10);
          if (!isNaN(idg) && !isNaN(cant) && cant > 0) { lineas.push({ id_producto, id_gusto: idg, cantidad: cant, precio }); total += precio * cant; }
        }
      } else {
        lineas.push({ id_producto, cantidad, precio });
        total += precio * cantidad;
      }
    }

    if (faltantes.length > 0) { await client.query('ROLLBACK'); return res.status(409).json({ error: `Sin stock, pedido cancelado: ${faltantes.join(', ')}.` }); }

    let recibido = null;
    if (metodo === 'efectivo') {
      recibido = Number(recibidoRaw);
      if (isNaN(recibido) || recibido < total) { await client.query('ROLLBACK'); return res.status(400).json({ error: `Lo recibido ($${recibido || 0}) es menor al total ($${total}).` }); }
    }

    const ped = await client.query(
      `INSERT INTO pedido (nombre, id_mozo, estado, resolved_at, metodo_pago, recibido)
       VALUES ($1, $2, 'confirmado', NOW(), $3, $4) RETURNING id_pedido`,
      [nombre, req.session.id_usuario, metodo, recibido]
    );
    const id_pedido = ped.rows[0].id_pedido;

    for (const d of aDescontar) {
      if (d.id_gusto != null) await client.query('UPDATE gusto SET stock = stock - $1 WHERE id_gusto = $2', [d.cantidad, d.id_gusto]);
      else await client.query('UPDATE producto SET stock = stock - $1 WHERE id_producto = $2', [d.cantidad, d.id_producto]);
      await client.query(`INSERT INTO movimiento_stock (id_producto, id_usuario, tipo, cantidad) VALUES ($1, $2, 'egreso', $3)`, [d.id_producto, req.session.id_usuario, d.cantidad]);
    }
    for (const l of lineas) {
      await client.query(
        `INSERT INTO pedido_item (id_pedido, id_producto, id_gusto, id_combo, cantidad, precio_unitario, detalle)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id_pedido, l.id_producto ?? null, l.id_gusto ?? null, l.id_combo ?? null, l.cantidad, l.precio, l.detalle ?? null]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Pedido confirmado.', id_pedido });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err && err.http) return res.status(err.http).json({ error: err.msg });
    console.error('Error al crear pedido:', err);
    res.status(500).json({ error: 'Error al crear el pedido.' });
  } finally { client.release(); }
}

const ITEMS_JSON = `
  COALESCE(
    json_agg(json_build_object(
      'producto', COALESCE(pr.nombre, cb.nombre),
      'gusto', g.nombre,
      'es_combo', (pi.id_combo IS NOT NULL),
      'detalle', pi.detalle,
      'cantidad', pi.cantidad,
      'precio_unitario', pi.precio_unitario,
      'subtotal', pi.cantidad * pi.precio_unitario
    ) ORDER BY pi.id_item) FILTER (WHERE pi.id_item IS NOT NULL), '[]'
  ) AS items,
  COALESCE(SUM(pi.cantidad * pi.precio_unitario), 0) AS total`;

const JOINS = `
  LEFT JOIN pedido_item pi ON pi.id_pedido = p.id_pedido
  LEFT JOIN producto pr ON pr.id_producto = pi.id_producto
  LEFT JOIN gusto g ON g.id_gusto = pi.id_gusto
  LEFT JOIN combo cb ON cb.id_combo = pi.id_combo`;

async function misPedidos(req, res) {
  try {
    const r = await pool.query(
      `SELECT p.id_pedido, p.nombre, p.estado, p.pagado, p.pagado_at, p.created_at, p.metodo_pago, ${ITEMS_JSON}
       FROM pedido p ${JOINS}
       WHERE p.id_mozo = $1
       GROUP BY p.id_pedido ORDER BY p.created_at DESC LIMIT 50`,
      [req.session.id_usuario]
    );
    res.json(r.rows);
  } catch (err) { console.error('Error misPedidos:', err); res.status(500).json({ error: 'Error interno del servidor.' }); }
}

async function porCobrar(req, res) {
  try {
    const r = await pool.query(
      `SELECT p.id_pedido, p.nombre, p.created_at, p.metodo_pago, p.recibido,
              u.nombre AS mozo_nombre, u.apellido AS mozo_apellido, ${ITEMS_JSON}
       FROM pedido p JOIN usuario u ON u.id_user = p.id_mozo ${JOINS}
       WHERE p.estado = 'confirmado' AND p.pagado = FALSE
       GROUP BY p.id_pedido, u.nombre, u.apellido ORDER BY p.created_at ASC`
    );
    res.json(r.rows);
  } catch (err) { console.error('Error porCobrar:', err); res.status(500).json({ error: 'Error interno del servidor.' }); }
}

async function marcarPagado(req, res) {
  const id = parseInt(req.params.id, 10);
  const metodo = req.body.metodo_pago;
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });
  if (metodo && !['efectivo', 'transferencia'].includes(metodo)) return res.status(400).json({ error: 'Método de pago inválido.' });
  try {
    const r = await pool.query(
      `UPDATE pedido SET pagado = TRUE, pagado_at = NOW(), id_cajero = $1, metodo_pago = COALESCE($2, metodo_pago)
       WHERE id_pedido = $3 AND estado = 'confirmado' AND pagado = FALSE RETURNING id_pedido`,
      [req.session.id_usuario, metodo || null, id]
    );
    if (r.rowCount === 0) return res.status(409).json({ error: 'El pedido no está para cobrar (no existe o ya está pagado).' });
    res.json({ message: 'Pago registrado.' });
  } catch (err) { console.error('Error marcarPagado:', err); res.status(500).json({ error: 'Error al registrar el pago.' }); }
}

async function historialCajero(req, res) {
  try {
    const r = await pool.query(
      `SELECT p.id_pedido, p.nombre, p.created_at, p.pagado_at, p.metodo_pago,
              m.nombre AS mozo_nombre, m.apellido AS mozo_apellido, ${ITEMS_JSON}
       FROM pedido p JOIN usuario m ON m.id_user = p.id_mozo ${JOINS}
       WHERE p.pagado = TRUE AND p.id_cajero = $1
       GROUP BY p.id_pedido, m.nombre, m.apellido ORDER BY p.pagado_at DESC LIMIT 100`,
      [req.session.id_usuario]
    );
    res.json(r.rows);
  } catch (err) { console.error('Error historialCajero:', err); res.status(500).json({ error: 'Error interno del servidor.' }); }
}

async function historialAdmin(req, res) {
  try {
    const r = await pool.query(
      `SELECT p.id_pedido, p.nombre, p.estado, p.pagado, p.pagado_at, p.created_at, p.metodo_pago,
              m.nombre AS mozo_nombre, m.apellido AS mozo_apellido,
              c.nombre AS cajero_nombre, c.apellido AS cajero_apellido, ${ITEMS_JSON}
       FROM pedido p JOIN usuario m ON m.id_user = p.id_mozo
       LEFT JOIN usuario c ON c.id_user = p.id_cajero ${JOINS}
       WHERE p.estado = 'confirmado'
       GROUP BY p.id_pedido, m.nombre, m.apellido, c.nombre, c.apellido ORDER BY p.created_at DESC LIMIT 200`
    );
    res.json(r.rows);
  } catch (err) { console.error('Error historialAdmin:', err); res.status(500).json({ error: 'Error interno del servidor.' }); }
}

module.exports = { crearPedido, misPedidos, porCobrar, marcarPagado, historialCajero, historialAdmin };