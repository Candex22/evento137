import { get, post } from './client'

export const login    = (correo_electronico, contrasena) =>
  post('/auth/login', { correo_electronico, contrasena })

export const register = (data) =>
  post('/auth/register', data)

export const logout   = () =>
  post('/auth/logout')

export const getMe    = () =>
  get('/auth/me')