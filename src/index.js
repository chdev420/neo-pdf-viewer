import VuePdfEmbed from './neo-pdf-viewer.vue'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.js'

VuePdfEmbed.getDocument = getDocument

if (typeof window !== 'undefined' && window.Vue) {
  window.VuePdfEmbed = VuePdfEmbed
}

export default VuePdfEmbed
