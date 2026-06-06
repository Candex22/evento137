import { get, patch } from './client'

export const porCobrar    = ()   => get('/cajero/por-cobrar')
export const marcarPagado = (id) => patch(`/cajero/pedidos/${id}/pagar`)
export const getHistorial = ()   => get('/cajero/historial')