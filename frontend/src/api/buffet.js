import { get, post } from './client'

export const getProductos   = ()                 => get('/buffet/productos')
export const crearIngreso   = (nombre, cantidad) => post('/buffet/ingresos', { nombre, cantidad })
