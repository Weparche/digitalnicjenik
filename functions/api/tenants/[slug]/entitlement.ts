import { readEntitlement, type RuntimeEnv } from '../../../_repository'

export const onRequestGet = async ({ params, env }: { params: Record<string, string>; env: RuntimeEnv }) => Response.json({ entitlement: await readEntitlement(env, params.slug) })
