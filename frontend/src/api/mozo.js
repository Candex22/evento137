import { get, post } from './client'

export const getProductos = ()        => get('/mozo/productos')
export const misPedidos   = ()        => get('/mozo/pedidos')
export const crearPedido  = (nombre, items, metodo_pago, recibido) =>
  post('/mozo/pedidos', { nombre, items, metodo_pago, recibido })