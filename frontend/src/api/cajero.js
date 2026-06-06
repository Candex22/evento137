import { get, patch } from './client'

export const porCobrar    = ()            => get('/cajero/por-cobrar')
export const marcarPagado = (id, metodo_pago) => patch(`/cajero/pedidos/${id}/pagar`, { metodo_pago })
export const getHistorial = ()            => get('/cajero/historial')