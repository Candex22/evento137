import { get, post, patch } from './client'

export const getProductos     = ()                          => get('/buffet/productos')
export const crearProducto    = (nombre, precio, tiene_gustos) => post('/buffet/productos', { nombre, precio, tiene_gustos })
export const agregarGusto     = (id, nombre, stock)         => post(`/buffet/productos/${id}/gustos`, { nombre, stock })
export const cargarStock      = (payload)                   => post('/buffet/ingresos', payload)
export const ajustarProducto  = (id, delta)                 => patch(`/buffet/productos/${id}/ajustar`, { delta })
export const ajustarGusto     = (id, delta)                 => patch(`/buffet/gustos/${id}/ajustar`, { delta })
export const actualizarPrecio = (id, precio)               => patch(`/buffet/productos/${id}/precio`, { precio })