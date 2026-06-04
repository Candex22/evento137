import { get, patch } from './client'

export const pedidosPendientes = ()           => get('/cajero/pedidos')
export const confirmarPedido   = (id)         => patch(`/cajero/pedidos/${id}/confirmar`)
export const rechazarPedido    = (id, motivo) => patch(`/cajero/pedidos/${id}/rechazar`, { motivo })

export const getProductos      = ()           => get('/cajero/productos')
export const actualizarPrecio  = (id, precio) => patch(`/cajero/productos/${id}/precio`, { precio })
export const getHistorial      = ()           => get('/cajero/historial')
export const porCobrar         = ()           => get('/cajero/por-cobrar')
export const marcarPagado      = (id)         => patch(`/cajero/pedidos/${id}/pagar`)