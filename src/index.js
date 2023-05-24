import NeoPdfViewer from './neo-pdf-viewer.vue'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.js'

NeoPdfViewer.getDocument = getDocument

if (typeof window !== 'undefined' && window.Vue) {
  window.NeoPdfViewer = NeoPdfViewer
}

export default NeoPdfViewer
