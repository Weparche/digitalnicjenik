import { describe, expect, it, vi } from 'vitest'
import { auditHostname, auditCutoff, onRequestGet, onRequestPost } from './sveusluge-audit'
import type { D1DatabaseLike } from '../../_repository'

const endpoint = 'https://digitalnicjenik.nepar.hr/api/ops/sveusluge-audit'
const key = 'test-operator-key'
const auth = { authorization: 'Bearer '+key }
const makeDb = (resolve:(sql:string,params:unknown[])=>unknown) => ({
  prepare: (sql:string) => {
    const statement = (params:unknown[]) => ({
      bind: (...values:unknown[]) => statement(values),
      first: async () => resolve(sql,params),
      all: async () => ({results:resolve(sql,params)}),
      run: async () => ({meta:{changes:1}})
    })
    return statement([])
  },
  batch: async () => []
}) as unknown as D1DatabaseLike

describe('SveUsluge technical audit bridge',()=>{
  it('validates hosts and uses a seven day UTC cutoff',()=>{
    expect(auditHostname('Example.hr')).toBe('example.hr')
    for(const host of ['localhost','127.0.0.1','evil.hr/path','https://example.hr','a@evil.hr','example.hr:8080']) expect(auditHostname(host)).toBeNull()
    expect(auditCutoff(new Date('2026-11-18T12:00:00Z'))).toBe('2026-11-11T12:00:00.000Z')
  })
  it('requires administrator auth before touching source storage',async()=>{
    const query=vi.fn()
    const env={SVEUSLUGE_AUDIT_DB:makeDb(query),OPERATOR_WRITE_KEY:key}
    const response=await onRequestGet({request:new Request(endpoint),env})
    expect(response.status).toBe(401)
    expect(query).not.toHaveBeenCalled()
  })
  it('returns only technical metadata and recent stored reports, excludes active sources',async()=>{
    const source=makeDb((sql,params)=>{
      expect(sql).toContain("state = 'NONE'")
      expect(sql).toContain("p.status = 'active'")
      expect(sql).not.toMatch(/email|phone|site_name/)
      expect(params[0]).toMatch(/^\d{4}-/)
      return sql.includes('COUNT(*)')?{total:1}:[{host:'example.hr',last_probe_at:'2026-11-17T00:00:00Z',last_status:200}]
    })
    const db=makeDb(()=>[{id:'r1',hostname:'example.hr',checked_at:'2026-11-18T00:00:00Z',score:4,status:'yellow',unknown_count:2,checks_json:'[]',discovered_urls_json:'[]'}])
    const response=await onRequestGet({request:new Request(endpoint,{headers:auth}),env:{SVEUSLUGE_AUDIT_DB:source,DB:db,OPERATOR_WRITE_KEY:key}})
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const data=await response.json()
    expect(data.candidates[0].checker).toMatchObject({id:'r1',score:4,unknownCount:2})
    expect(data.candidates[0]).not.toHaveProperty('email')
  })
  it('reuses a recent check instead of fetching a site again',async()=>{
    const source=makeDb(()=>({host:'example.hr',last_probe_at:'2026-11-17T00:00:00Z',last_status:200}))
    const db=makeDb(()=>({id:'r1',hostname:'example.hr',checked_at:'2026-11-18T00:00:00Z',score:9,status:'green',unknown_count:0,checks_json:'[]',discovered_urls_json:'[]'}))
    const request=new Request(endpoint,{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({host:'example.hr'})})
    const response=await onRequestPost({request,env:{SVEUSLUGE_AUDIT_DB:source,DB:db,OPERATOR_WRITE_KEY:key}})
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({reused:true,checker:{id:'r1',score:9}})
  })
  it('rejects domains outside the eligible inventory',async()=>{
    const request=new Request(endpoint,{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({host:'example.hr'})})
    const response=await onRequestPost({request,env:{SVEUSLUGE_AUDIT_DB:makeDb(()=>null),DB:makeDb(()=>null),OPERATOR_WRITE_KEY:key}})
    expect(response.status).toBe(404)
  })
})
