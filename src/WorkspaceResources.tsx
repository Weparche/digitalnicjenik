import { useState } from 'react'
import { IconArrowRight,IconArrowUpRight,IconCheck,IconCopy,IconDownload,IconFileSpreadsheet } from '@tabler/icons-react'
import { INSTALLATION,PLANS,formatEur } from '../shared/pricing'
import { formatCents,orderAmountCents,UPGRADE_WINDOW_DAYS } from '../shared/payment'
import { untilLabel } from './licenceView'

export const HOK_TEMPLATES_URL='https://www.hok.hr/novosti-iz-hok/dodatna-cijena-i-objava-cjenika-od-1-listopada-2026-najvaznije-informacije'

export function FirstPublicationNotice({publicUrl,expiresAt}:{publicUrl:string;expiresAt:string}){
  const [copied,setCopied]=useState(false)
  const [error,setError]=useState('')
  async function copy(){
    try{await navigator.clipboard.writeText(publicUrl);setCopied(true);setError('')}
    catch{setError('Kopiranje nije uspjelo. Označite i kopirajte poveznicu ispod.')}
  }
  return <section className="workspace-first-publication" aria-labelledby="first-publication-title">
    <div className="workspace-resource-heading"><IconCheck size={24}/><div><h2 id="first-publication-title">Cjenik je objavljen</h2><p>Besplatna objava dostupna je do <strong>{untilLabel(expiresAt)}</strong>.</p></div></div>
    <a className="workspace-url" href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a>
    <div className="workspace-publication-share"><button className="workspace-button" type="button" onClick={()=>void copy()}><IconCopy size={17}/>{copied?'Link je kopiran':'Kopiraj link'}</button><a href={publicUrl} target="_blank" rel="noreferrer">Otvori cjenik<IconArrowUpRight size={17}/></a><span role="status">{copied?'Link je spreman za dijeljenje.':''}</span></div>
    {error&&<p role="alert">{error}</p>}
    <p>Nakon besplatne objave isti link možete zadržati za {formatEur(PLANS[0].price)} za cijelu godinu.</p>
  </section>
}

export function TrialOffer({published=false,onHelp}:{published?:boolean;onHelp:()=>void}){
  return <section className="workspace-trial-offer" aria-label="Besplatna objava i cijena">
    <div><h2>{published?'Isprobavate besplatnu objavu cjenika':'Objavite cjenik besplatno na 24 h'}</h2><p>Nakon toga zadržite isti link uz Web Link za <strong>{formatEur(PLANS[0].price)} za cijelu godinu.</strong> Bez automatske naplate.</p></div>
    <button type="button" onClick={onHelp}>{published?'Kako zadržati link?':'Upute i predlošci'}<IconArrowRight size={17}/></button>
  </section>
}

export function WorkspaceInstructions({onPrepare}:{onPrepare:()=>void}){
  return <div className="workspace-stack workspace-guide">
    <section className="workspace-surface">
      <h2>Od datoteke do javnog cjenika</h2>
      <ol className="workspace-guide-steps">
        <li><strong>Pripremite Excel, CSV ili XML.</strong><p>Jedna stavka u svakom retku. Za početak možete koristiti HOK predložak ili naš popunjeni primjer u nastavku.</p></li>
        <li><strong>Učitajte i provjerite podatke.</strong><p>U „Moj cjenik” učitajte datoteku. Za Excel odaberite stupce i pregledajte rezultat. Nedostajuće podatke dopunite prije objave.</p></li>
        <li><strong>Prvi cjenik objavite besplatno na 24 h.</strong><p>Unesite podatke poslovanja i potvrdite e-mail ako već niste prijavljeni. Dobivate javni link, CSV i XML.</p></li>
        <li><strong>Zadržite isti link i podijelite ga.</strong><p>Web Link je {formatEur(PLANS[0].price)} za godinu dana. Podatke za bankovnu uplatu pronađite u „Paketi i cijene”. „Uplatio sam” prijavljuje uplatu; aktivacija slijedi nakon NEPAR potvrde. QR i ugradnja su u „Objava i ugradnja”.</p></li>
      </ol>
      <button type="button" className="workspace-button" onClick={onPrepare}>Otvori moj cjenik<IconArrowRight size={17}/></button>
    </section>
    <section className="workspace-surface" aria-labelledby="hok-templates-title">
      <div className="workspace-resource-heading"><IconFileSpreadsheet size={26}/><div><h2 id="hok-templates-title">Krenite od HOK Excel predloška</h2><p>HOK objavljuje zasebne predloške za proizvode i za usluge.</p></div></div>
      <p>Na službenoj stranici, u odjeljku „Preuzimanja”, odaberite <strong>HOK predložak cjenika USLUGA</strong> ili <strong>HOK predložak cjenika PROIZVODA</strong> (.xlsx). Ispunite ga svojim podacima i učitajte ovdje, bez ručnog pretvaranja u CSV.</p>
      <a className="workspace-button" href={HOK_TEMPLATES_URL} target="_blank" rel="noreferrer">Otvori HOK Excel predloške<IconArrowUpRight size={17}/></a>
      <details className="workspace-example" open>
        <summary>Kako izgledaju popunjeni podaci?</summary>
        <p>Ilustrativni NEPAR primjer za usluge. Ovo nije preslika službenog HOK predloška. Cijene u primjeru zamijenite svojima.</p>
        <div className="workspace-example-table" role="region" aria-label="Primjer popunjenog cjenika usluga" tabIndex={0}><table><thead><tr><th scope="col">Naziv usluge</th><th scope="col">Cijena (€)</th><th scope="col">Sidrena cijena (€)</th><th scope="col">Poseban oblik prodaje</th></tr></thead><tbody><tr><td>Muško šišanje</td><td>15,00</td><td>15,00</td><td>NE</td></tr><tr><td>Žensko šišanje</td><td>21,00</td><td>18,00</td><td>NE</td></tr></tbody></table></div>
        <div className="workspace-resource-links"><a href="/examples/primjer-digitalni-cjenik-usluge-2026.csv" download><IconDownload size={17}/>NEPAR primjer usluga (.csv)</a><a href="/examples/nepar-format-primjer-proizvodi.csv" download><IconDownload size={17}/>NEPAR primjer proizvoda (.csv)</a></div>
      </details>
    </section>
    <section className="workspace-surface"><h2>Kad se cijene promijene</h2><p><strong>Web Link:</strong> ažurirajte svoju datoteku i odaberite „Zamijeni cjenik”. Pogrešna datoteka ne zamjenjuje postojeću objavu. <strong>Publisher:</strong> uređujte stavke u dashboardu, spremite promjene i objavite novu verziju. Javni URL ostaje isti.</p><div className="workspace-resource-links"><a href="/vijesti/hok-excel-predlosci-digitalni-cjenik-2026/">Detaljniji vodič za HOK predloške<IconArrowUpRight size={16}/></a><a href="mailto:nepar@nepar.hr">Trebate pomoć? nepar@nepar.hr</a></div></section>
  </div>
}

export function WorkspacePackages({onPrepare,onContact}:{onPrepare?:()=>void;onContact?:()=>void}){
  return <section className="workspace-surface workspace-packages" aria-labelledby="workspace-packages-title">
    <h2 id="workspace-packages-title">Godišnji paketi</h2>
    <p>Svi godišnji paketi zadržavaju isti javni link. Plaćanje je bankovnom uplatom, bez automatske naplate.</p>
    <dl className="workspace-price-list">{PLANS.map(plan=><div key={plan.id}><dt>{plan.name}<span>{plan.id==='link'?'Cjenik vodite u svojoj datoteci.':plan.id==='publisher'?'Cjenik uređujete ovdje.':'Novi jednostavni web i cjenik.'}</span></dt><dd className="workspace-price-amount">{formatEur(plan.price)}<small>/ godina</small></dd><dd className="workspace-price-description">{plan.summary}{plan.id==='web'&&(onContact?<button className="workspace-button-link" type="button" onClick={onContact}>Zatraži ponudu<IconArrowUpRight size={16}/></button>:<a href="/app?new=1&tab=kontakt&plan=web">Zatraži ponudu<IconArrowUpRight size={16}/></a>)}</dd></div>)}</dl>
    <h3>Dodatne usluge</h3>
    <dl className="workspace-price-list workspace-price-extras"><div><dt>Web Link → Publisher<span>U prvih {UPGRADE_WINDOW_DAYS} dana od početka licence.</span></dt><dd className="workspace-price-amount">+{formatCents(orderAmountCents('publisher_upgrade'))}<small>jednokratna razlika</small></dd><dd className="workspace-price-description">Nadogradnja zadržava kraj već plaćenog razdoblja.</dd></div><div><dt>Standardna ugradnja<span>Na vašem postojećem webu.</span></dt><dd className="workspace-price-amount">{formatEur(INSTALLATION.price)}<small>jednokratno</small></dd><dd className="workspace-price-description">Jedan link, gumb, NEPAR embed ili redirect. Bez izrade novog weba i popravka CMS-a.</dd></div></dl>
    {onPrepare&&<div className="workspace-package-start"><p>Prvo pripremite i objavite cjenik. Paket možete odabrati nakon besplatne objave.</p><button className="workspace-button" type="button" onClick={onPrepare}>Pripremi cjenik besplatno<IconArrowRight size={17}/></button></div>}
  </section>
}
