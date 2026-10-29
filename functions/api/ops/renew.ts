import type { TrialEnv } from '../../_trial'
import { requireAdmin, opsError, OPS_HEADERS } from '../../_admin-auth'
import { applyOperation } from '../../_operations'
import { resolveTenant } from '../../_repository'
import { AccessDeniedError } from '../../_write-auth'
import { dispatchLifecycle } from '../../../shared/lifecycle'
export const onRequestPost = async ({request,env,waitUntil}:{request:Request;env:TrialEnv;waitUntil?:(p:Promise<unknown>)=>void}) => {
  try {
    const actor=await requireAdmin(request,env)
    const body=await request.json() as Record<string,unknown>
    const tenant=await resolveTenant(env,String(body.slug??''))
    if (!tenant || !env.DB) throw new AccessDeniedError(404,'tenant_missing','Tenant nije pronađen.')
    const result=await applyOperation(env.DB,actor,tenant,body)
    waitUntil?.(dispatchLifecycle({...env,DB:env.DB}))
    return Response.json({ok:true,...result},{headers:OPS_HEADERS})
  } catch(error) {return opsError(error)}
}
