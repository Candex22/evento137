import { get, post, patch } from './client'

export const getEstado = ()              => get('/entradas/estado')
export const getLista  = ()              => get('/entradas/lista')
export const generar   = (desde, hasta)  => post('/entradas/generar', { desde, hasta })
export const tachar    = (numero)        => patch(`/entradas/${numero}/tachar`)
export const ajustar   = (delta)         => post('/entradas/contador', { delta })