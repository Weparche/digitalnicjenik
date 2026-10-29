/** Shared IDs for the later static renderer and today's human-fulfilled quotes. */
export const WEB_TEMPLATES = [
  {id:'minimal',name:'Minimal',audience:'Univerzalan, čist i profesionalan'},
  {id:'salon',name:'Salon',audience:'Frizeri, kozmetika i beauty'},
  {id:'service',name:'Servis',audience:'Autoservisi, instalateri i tehničke usluge'},
  {id:'food',name:'Food',audience:'Restorani, caffe i catering'},
  {id:'wellness',name:'Wellness',audience:'Masaža, fizioterapija i wellness'},
  {id:'shop',name:'Shop',audience:'Trgovina, cvjećarna i pet shop'},
] as const
export type WebTemplateId=typeof WEB_TEMPLATES[number]['id']
export function templateId(value:unknown){return WEB_TEMPLATES.find(template=>template.id===value)?.id??null}
