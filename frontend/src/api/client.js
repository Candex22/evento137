const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const err = new Error(data.error || `Error ${res.status}`)
    err.status = res.status
    throw err
  }

  return data
}

export const get  = (path)         => request(path)
export const post = (path, body)   => request(path, { method: 'POST',   body: JSON.stringify(body) })
export const patch= (path, body={})=> request(path, { method: 'PATCH',  body: JSON.stringify(body) })
export const del  = (path)         => request(path, { method: 'DELETE' })