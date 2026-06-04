import { get, post } from './client'

export const getProductos = ()             => get('/mozo/productos')
export const crearPedido   = (nombre, items) => post('/mozo/pedidos', { nombre, items })
export const misPedidos    = ()             => get('/mozo/pedidos')