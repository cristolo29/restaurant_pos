import { useCallback, useState } from 'react'
import { PageHeader, Tabs } from '../components/ui'
import ModalConfirm from '../components/ModalConfirm'
import { toast } from '../store/useToast'
import useAdminDatos from './admin/useAdminDatos'
import SeccionCrud from './admin/SeccionCrud'
import ComprobantesSeccion from './admin/ComprobantesSeccion'
import CamposSeccion from './admin/CamposSeccion'
import FormModal from './admin/FormModal'
import { SECCIONES, TABS } from './admin/secciones'
import { interpretarError } from './admin/util'

const SIN_ERRORES = { general: '', campos: {} }

export default function Admin() {
  const [tab, setTab] = useState('mesas')
  const { datos, cargando, error, recargar } = useAdminDatos()
  const [modal, setModal] = useState(null)      // { tipo: 'crear' | 'editar', datos }
  const [form, setForm] = useState({})
  const [errores, setErrores] = useState(SIN_ERRORES)
  const [guardando, setGuardando] = useState(false)
  const [modalConfirm, setModalConfirm] = useState(null)

  const def = SECCIONES[tab]

  const cerrarModal = useCallback(() => { setModal(null); setForm({}); setErrores(SIN_ERRORES) }, [])
  const abrirCrear = () => { setModal({ tipo: 'crear', datos: null }); setForm({}); setErrores(SIN_ERRORES) }
  const abrirEditar = (raw) => { setModal({ tipo: 'editar', datos: raw }); setForm(raw); setErrores(SIN_ERRORES) }

  const guardar = async () => {
    setGuardando(true)
    setErrores(SIN_ERRORES)
    const payload = def.payload(form)
    try {
      if (modal.tipo === 'crear') await def.crear(payload)
      else await def.actualizar(modal.datos.id, payload)
      await recargar()
      toast.exito(modal.tipo === 'crear' ? `${def.singular[0].toUpperCase()}${def.singular.slice(1)} creado correctamente` : 'Cambios guardados')
      cerrarModal()
    } catch (e) {
      setErrores(interpretarError(e, Object.keys(payload)))
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = (raw) => {
    const nombre = def.etiqueta(raw)
    setModalConfirm({
      titulo: `¿Eliminar ${def.articulo} "${nombre}"?`,
      mensaje: `Se eliminará ${def.articulo} "${nombre}" de forma permanente. Esta acción no se puede deshacer.`,
      labelConfirm: 'Eliminar',
      colorConfirm: 'danger',
      onConfirm: async () => {
        await def.eliminar(raw.id)
        await recargar()
        toast.exito(`Se eliminó ${def.articulo} "${nombre}"`)
      },
    })
  }

  const tituloModal = modal && `${modal.tipo === 'crear' ? 'Nuevo' : 'Editar'} ${def.singular}`

  return (
    <div className="min-h-dvh bg-app text-ink">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-8">
        <PageHeader title="Administración" subtitle="Catálogo, personal y comprobantes del local" />

        <Tabs tabs={TABS} value={tab} onChange={setTab} idBase="admin" label="Secciones de administración" className="mb-5" />

        <div role="tabpanel" id="admin-panel" aria-labelledby={`admin-tab-${tab}`}>
          {tab === 'comprobantes' ? (
            <ComprobantesSeccion comprobantes={datos.comprobantes} cargando={cargando} error={error} onReintentar={recargar} />
          ) : (
            <SeccionCrud
              key={tab}
              id={tab}
              datos={datos}
              cargando={cargando}
              error={error}
              onReintentar={recargar}
              onNuevo={abrirCrear}
              onEditar={abrirEditar}
              onEliminar={eliminar}
            />
          )}
        </div>
      </div>

      {modal && (
        <FormModal titulo={tituloModal} onCerrar={cerrarModal} onGuardar={guardar} guardando={guardando} errorGeneral={errores.general}>
          <CamposSeccion seccion={tab} form={form} setForm={setForm} errores={errores.campos} datos={datos} />
        </FormModal>
      )}

      {modalConfirm && <ModalConfirm {...modalConfirm} onCancel={() => setModalConfirm(null)} />}
    </div>
  )
}
