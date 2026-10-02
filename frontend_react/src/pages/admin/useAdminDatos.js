import { useCallback, useEffect, useState } from 'react'
import {
  getMesas, getCategorias, getProductos, getUsuarios, getRoles, getSalones, getComprobantes,
} from '../../api/admin'

const VACIO = { salones: [], mesas: [], categorias: [], productos: [], usuarios: [], roles: [], comprobantes: [] }

/** Trae todo el catálogo. Cada petición que falla cae a [] (como antes) y se marca `fallo`. */
async function traerTodo() {
  let fallo = false
  const seguro = (p) => p.catch(() => { fallo = true; return [] })
  const [salones, mesas, categorias, productos, usuarios, roles, comprobantes] = await Promise.all([
    seguro(getSalones()), seguro(getMesas()), seguro(getCategorias()), seguro(getProductos()),
    seguro(getUsuarios()), seguro(getRoles()), seguro(getComprobantes()),
  ])
  return { datos: { salones, mesas, categorias, productos, usuarios, roles, comprobantes }, fallo }
}

export default function useAdminDatos() {
  const [estado, setEstado] = useState({ datos: VACIO, cargando: true, error: false })

  const recargar = useCallback(async () => {
    const { datos, fallo } = await traerTodo()
    setEstado({ datos, cargando: false, error: fallo })
  }, [])

  useEffect(() => {
    let activo = true
    traerTodo().then(({ datos, fallo }) => {
      if (activo) setEstado({ datos, cargando: false, error: fallo })
    })
    return () => { activo = false }
  }, [])

  return { ...estado, recargar }
}
