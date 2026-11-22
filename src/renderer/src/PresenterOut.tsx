import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PresenterOutState, PresenterSlideSource } from '../../shared/presenterOut'
import { loadPdf, renderPageContain } from './pdf'
import './PresenterOut.css'

function SlidePreview({
  source,
  page,
  doc,
  which,
  emptyText = 'Brak następnego slajdu'
}: {
  source: PresenterSlideSource
  page: number | null
  doc: PDFDocumentProxy | null
  which: 'current' | 'next'
  emptyText?: string
}): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageUrl =
    source.kind === 'image' ? (which === 'current' ? source.currentUrl : source.nextUrl) : null

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas || !doc || page === null || source.kind !== 'pdf') return
    const render = (): void => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (width < 1 || height < 1) return
      renderPageContain(doc, page, canvas, width, height).catch((err) =>
        console.error('Presenter preview failed to render:', err)
      )
    }
    const observer = new ResizeObserver(render)
    observer.observe(container)
    render()
    return () => observer.disconnect()
  }, [source.kind, page, doc])

  return (
    <div className="presenter-preview-frame" ref={containerRef}>
      {page === null ? (
        <div className="presenter-preview-empty">{emptyText}</div>
      ) : source.kind === 'pdf' ? (
        doc ? <canvas ref={canvasRef} /> : <div className="presenter-preview-empty">Ładowanie…</div>
      ) : imageUrl ? (
        <img src={imageUrl} alt={which === 'current' ? 'Aktualny slajd' : 'Następny slajd'} />
      ) : (
        <div className="presenter-preview-empty">
          {which === 'next' ? 'Podgląd niedostępny' : 'Brak obrazu'}
        </div>
      )}
    </div>
  )
}

function PresenterOut(): React.JSX.Element {
  const [state, setState] = useState<PresenterOutState | null>(null)
  const [pdf, setPdf] = useState<{ data: string; doc: PDFDocumentProxy } | null>(null)
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null)
  const pdfData = state?.source.kind === 'pdf' ? state.source.data : null

  useEffect(() => {
    // Subscribe before requesting a snapshot. A concurrent newer push must not
    // be overwritten by a delayed reply containing an older snapshot.
    let receivedPush = false
    const unsubscribe = window.api.presenterOut.onState((next) => {
      receivedPush = true
      setState(next)
    })
    window.api.presenterOut.getState().then((snapshot) => {
      if (!receivedPush && snapshot) setState(snapshot)
    }).catch((err) => console.error('Presenter state unavailable:', err))
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!pdfData) {
      if (pdfDocRef.current) {
        void pdfDocRef.current.destroy()
        pdfDocRef.current = null
      }
      setPdf(null)
      return
    }
    let cancelled = false
    loadPdf(pdfData)
      .then((doc) => {
        if (cancelled) {
          void doc.destroy()
          return
        }
        if (pdfDocRef.current && pdfDocRef.current !== doc) void pdfDocRef.current.destroy()
        pdfDocRef.current = doc
        setPdf({ data: pdfData, doc })
      })
      .catch((err) => console.error('Presenter PDF failed to load:', err))
    return () => { cancelled = true }
  }, [pdfData])

  useEffect(() => () => {
    if (pdfDocRef.current) void pdfDocRef.current.destroy()
  }, [])

  if (!state) return <div className="presenter-out-loading">Oczekiwanie na prezentację</div>
  const { source, currentPage, totalPages, fileName, programBlank, nextAvailable } = state
  const activeDoc = source.kind === 'pdf' && pdf?.data === source.data ? pdf.doc : null
  const hasNextPage = currentPage < totalPages
  const nextPage = nextAvailable && hasNextPage ? currentPage + 1 : null

  return (
    <main className="presenter-out">
      <header className="presenter-out-header">
        <div className="presenter-out-title">{fileName || 'Prezentacja'}</div>
        <div className="presenter-out-count">{currentPage} / {totalPages}</div>
        {programBlank !== 'none' && (
          <div className="presenter-out-blank">PROGRAM: {programBlank === 'black' ? 'CZARNY' : 'BIAŁY'}</div>
        )}
      </header>
      <section className="presenter-out-slides">
        <div className="presenter-out-card presenter-out-current">
          <div className="presenter-out-label">AKTUALNY</div>
          <SlidePreview source={source} page={currentPage} doc={activeDoc} which="current" />
        </div>
        <div className="presenter-out-card presenter-out-next">
          <div className="presenter-out-label">NASTĘPNY</div>
          <SlidePreview source={source} page={nextPage} doc={activeDoc} which="next" emptyText={hasNextPage ? 'Podgląd niedostępny' : 'Brak następnego slajdu'} />
        </div>
      </section>
      <section className="presenter-out-notes">
        <div className="presenter-out-label">NOTATKI PRELEGENTA</div>
        <div className="presenter-out-notes-body">{state.notes || 'Brak notatek do tego slajdu'}</div>
      </section>
    </main>
  )
}

export default PresenterOut
