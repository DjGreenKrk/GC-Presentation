import type { ScreenBlank } from './programOut'

/**
 * Read-only confidence monitor. Send the PDF bytes only once: Program and
 * Next pages are rendered by the same PDFDocumentProxy in Presenter Out.
 */
export type PresenterSlideSource =
  | { kind: 'pdf'; data: string }
  | { kind: 'image'; currentUrl: string; nextUrl: string | null }

export interface PresenterOutState {
  source: PresenterSlideSource
  currentPage: number
  totalPages: number
  notes: string
  fileName: string
  /** Presenter must keep showing content when Program is black/white. */
  programBlank: ScreenBlank
  /** False for Google Slides/Canva, which cannot provide future frames. */
  nextAvailable: boolean
}
