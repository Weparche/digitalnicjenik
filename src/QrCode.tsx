import QRCode from 'qrcode'
import { useMemo } from 'react'

function modulePath(text: string) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const size = modules.size
  const quiet = 2
  let path = ''
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (modules.get(row, col)) path += `M${col + quiet} ${row + quiet}h1v1h-1z`
    }
  }
  return { path, viewBox: size + quiet * 2 }
}

/** Renders a QR code as inline SVG (no innerHTML): only integers and a fixed path alphabet are produced. */
export function QrCode({ value, label, size = 160, svgId }: { value: string; label: string; size?: number; svgId?: string }) {
  const { path, viewBox } = useMemo(() => modulePath(value), [value])
  return (
    <svg id={svgId} className="qr-code" role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${viewBox} ${viewBox}`} shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
      <rect width={viewBox} height={viewBox} fill="#ffffff" />
      <path d={path} fill="#0f172a" />
    </svg>
  )
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function downloadQrSvg(svgId: string, filename: string) {
  const svg = document.getElementById(svgId)
  if (!svg) return
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  triggerDownload(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadQrPng(svgId: string, filename: string, pixels = 1024) {
  const svg = document.getElementById(svgId)
  if (!svg) return
  const source = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }))
  const image = new Image()
  image.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = pixels
    canvas.height = pixels
    const context = canvas.getContext('2d')
    if (context) {
      context.imageSmoothingEnabled = false
      context.drawImage(image, 0, 0, pixels, pixels)
      canvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        triggerDownload(url, filename)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }, 'image/png')
    }
    URL.revokeObjectURL(source)
  }
  image.src = source
}
