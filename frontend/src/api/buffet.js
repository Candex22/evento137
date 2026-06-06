import { get, post, patch } from './client'

export const getProductos = ()                 => get('/buffet/productos')
export const crearIngreso = (nombre, cantidad) => post('/buffet/ingresos', { nombre, cantidad })
export const ajustarStock = (id, delta)        => patch(`/buffet/productos/${id}/ajustar`, { delta })