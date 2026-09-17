export const onRequestPost = async ({ request }: { request: Request }) => {
  let payload: { event?: string; customerId?: string }
  try { payload = await request.json() as { event?: string; customerId?: string } } catch { return Response.json({ ok: false, message: 'Payload mora biti valjan JSON.' }, { status: 400 }) }
  // Replace mock source with the official Marketino webhook verification and read-only fetch once the specification is available.
  return Response.json({ ok: true, accepted: payload.event === 'price_list.updated', customerId: payload.customerId ?? null, mode: 'skeleton' }, { status: 202 })
}
