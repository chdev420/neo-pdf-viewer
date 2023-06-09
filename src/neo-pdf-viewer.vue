<template>
  <div :id="id" class="neo-pdf-viewer">
    <template v-if="fileType == 'pdf'">
      <div
        v-for="(pageNum, index) in pageNums"
        :key="pageNum"
        :id="id && `${id}-${pageNum}`"
      >
        <PinchScrollZoom
          ref="zoomer"
          :width="mywidth(index)"
          :height="myheight(index)"
          :scale="1"
          :min-scale="1"
          :draggable="draggable"
        >
          <canvas></canvas>
          <div v-if="!disableTextLayer" class="textLayer" />
          <div v-if="!disableAnnotationLayer" class="annotationLayer" />
        </PinchScrollZoom>
      </div>
    </template>
    <div v-if="/(gif|jpe?g|png|webp|bmp)$/i.test(fileType)">
      <PinchScrollZoom
        ref="zoomer"
        :width="myImageWidthVar"
        :height="myImageHeightVar"
        :scale="1"
        :min-scale="1"
        :draggable="draggable"
        :id="id && `${id}-1`"
        v-if="myImageWidthVar"
      >
        <img ref="imageRef" :src="source" />
      </PinchScrollZoom>
      <img id="myImage" ref="imageRef" :src="source" v-if="!myImageWidthVar" />
    </div>
  </div>
</template>

<script>
import PinchScrollZoom, {
  PinchScrollZoomEmitData,
} from '@coddicat/vue3-pinch-scroll-zoom'

import * as pdf from 'pdfjs-dist/legacy/build/pdf.js'
import PdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.js'
import { PDFLinkService } from 'pdfjs-dist/legacy/web/pdf_viewer.js'
import {
  addPrintStyles,
  createPrintIframe,
  emptyElement,
  releaseChildCanvases,
} from './util.js'

pdf.GlobalWorkerOptions.workerPort = new PdfWorker()

export default {
  name: 'NeoPdfViewer',
  components: {
    PinchScrollZoom,
  },
  props: {
    /**
     * Whether the annotation layer should be disabled.
     * @values Boolean
     */
    disableAnnotationLayer: Boolean,
    /**
     * Whether the text layer should be disabled.
     * @values Boolean
     */
    disableTextLayer: Boolean,
    /**
     * Desired page height.
     * @values Number, String
     */
    height: [Number, String],
    /**
     * Component identifier (inherited by page containers with page number
     * postfixes).
     * @values String
     */
    id: String,
    /**
     * Path for annotation icons, including trailing slash.
     * @values String
     */
    imageResourcesPath: String,
    /**
     * Number of the page to display.
     * @values Number
     */
    page: Number,
    /**
     * Desired page rotation angle.
     * @values Number, String
     */
    rotation: {
      type: [Number, String],
      validator(value) {
        if (value % 90 !== 0) {
          throw new Error('Rotation must be 0 or a multiple of 90.')
        }
        return true
      },
    },
    /**
     * Desired ratio of canvas size to document size.
     * @values Number
     */
    scale: Number,
    /**
     * Source of the document to display.
     * @values Object, String, URL, TypedArray
     */
    source: {
      type: [Object, String, URL, Uint8Array],
      required: true,
    },
    /**
     * Desired page width.
     * @values Number, String
     */
    width: [Number, String],
    showPages: Number,
    onePage: Boolean,
    draggable: Boolean,
    fileType: String,
  },
  data() {
    return {
      document: null,
      pageCount: null,
      pageNums: [],
      renderedPages: [],
      renderedPageSize: [],
      myImageWidthVar: 0,
      myImageHeightVar: 0,
    }
  },
  computed: {
    linkService() {
      if (!this.document || this.disableAnnotationLayer) {
        return null
      }

      const service = new PDFLinkService()
      service.setDocument(this.document)
      service.setViewer({
        scrollPageIntoView: ({ pageNumber }) => {
          this.$emit('internal-link-clicked', pageNumber)
        },
      })
      return service
    },
    myheight() {
      return (i) =>
        parseInt(this.renderedPageSize[i]?.height?.replace('px', '') ?? 300)
    },
    mywidth() {
      return (i) =>
        parseInt(this.renderedPageSize[i]?.width?.replace('px', '') ?? 400)
    },
    async myImageWidth() {
      const imageRef = this.$refs.imageRef
      if (!imageRef) return 300
      return imageRef.clientWidth
    },
    async myImageHeight() {
      const imageRef = this.$refs.imageRef
      if (!imageRef) return 300
      return imageRef.clientHeight
    },
  },
  created() {
    if (this.fileType == 'pdf') {
      this.$watch(
        () => [
          this.source,
          this.disableAnnotationLayer,
          this.disableTextLayer,
          this.height,
          this.page,
          this.rotation,
          this.width,
          this.showPages,
        ],
        async ([newSource], [oldSource]) => {
          if (newSource !== oldSource) {
            releaseChildCanvases(this.$el)
            await this.load()
          }
          this.render()
        }
      )
      this.$watch(
        () => this.onePage,
        () => {
          this.renderedPages = []
        }
      )
    }
  },
  async mounted() {
    if (this.fileType == 'pdf') {
      await this.load()
      this.render()
    }
    if (/(gif|jpe?g|png|webp|bmp)$/i.test(this.fileType)) {
      let myImage = document.getElementById('myImage')
      let myImageWidth = 0
      let myImageHeight = 0
      while (!myImage || !myImageWidth || !myImageHeight) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        myImage = document.getElementById('myImage')
        myImageWidth = myImage?.clientWidth ?? 0
        myImageHeight = myImage?.clientHeight ?? 0
      }
      // i want my image width to match 90% of the width of the window
      const scale = (0.9 * window.innerWidth) / myImageWidth
      const newWidth = myImageWidth * scale
      const newHeight = myImageHeight * scale
      this.myImageWidthVar = newWidth
      this.myImageHeightVar = newHeight
    }
    if (!/(gif|jpe?g|png|webp|bmp|pdf)$/i.test(this.fileType)) {
      console.error('Unsupported file type')
      console.error(this.fileType)
      this.$emit('rendering-failed')
    }
  },
  beforeDestroy() {
    releaseChildCanvases(this.$el)
    this.document?.destroy()
  },
  beforeUnmount() {
    releaseChildCanvases(this.$el)
    this.document?.destroy()
  },
  methods: {
    /**
     * Returns an array of the actual page width and height based on props and
     * aspect ratio.
     * @param {number} ratio - Page aspect ratio.
     */
    getPageDimensions(page, ratio) {
      const rotation = page?._pageInfo?.rotate ?? 0
      let height, width
      if (this.height && !this.width) {
        height = this.height
        width = height / ratio
      } else {
        width = this.width || this.$el.clientWidth
        height = width * ratio
      }
      /* Height and width must be inverted if rotation
       * is 90, 270, 450, etc., i.e. any degree like
       * ROTATION = 90 + 180x.
       * To figure out if dimensions must be inverted we can make
       * the reverse formula anche check the following condition
       * (ROTATION - 90) % 180 == 0
       *
       * Considering the rotation property can be a number or string
       * we must also convert it to number first
       */
      const invertDimensions = (rotation - 90) % 180 === 0
      return [
        invertDimensions ? height : width,
        invertDimensions ? width : height,
      ]
    },
    /**
     * Loads a PDF document. Defines a password callback for protected
     * documents.
     *
     * NOTE: Ignored if source property is not provided.
     */
    async load() {
      if (!this.source) {
        return
      }

      try {
        if (this.source._pdfInfo) {
          this.document = this.source
        } else {
          const documentLoadingTask = pdf.getDocument(this.source)
          documentLoadingTask.onProgress = (progressParams) => {
            this.$emit('progress', progressParams)
          }
          documentLoadingTask.onPassword = (callback, reason) => {
            const retry = reason === pdf.PasswordResponses.INCORRECT_PASSWORD
            this.$emit('password-requested', callback, retry)
          }
          this.document = await documentLoadingTask.promise
        }
        this.pageCount = this.document.numPages
        this.$emit('loaded', this.document)
      } catch (e) {
        this.document = null
        this.pageCount = null
        this.pageNums = []
        this.$emit('loading-failed', e)
      }
    },
    /**
     * Prints a PDF document via the browser interface.
     *
     * NOTE: Ignored if the document is not loaded.
     *
     * @param {number} dpi - Print resolution.
     * @param {string} filename - Predefined filename to save.
     * @param {boolean} allPages - Ignore page prop to print all pages.
     */
    async print(dpi = 300, filename = '', allPages = false) {
      if (!this.document) {
        return
      }

      const printUnits = dpi / 72
      const styleUnits = 96 / 72
      let container, iframe, title

      try {
        container = document.createElement('div')
        container.style.display = 'none'
        window.document.body.appendChild(container)
        iframe = await createPrintIframe(container)

        const pageNums =
          this.page && !allPages
            ? [this.page]
            : this.showPages > this.pageCount
            ? [...Array(this.pageCount + 1).keys()].slice(1)
            : [...Array(this.showPages + 1).keys()].slice(1)

        await Promise.all(
          pageNums.map(async (pageNum, i) => {
            if (this.renderedPages.includes(pageNum)) {
              return
            }
            this.renderedPages.push(pageNum)
            const page = await this.document.getPage(pageNum)
            const viewport = page.getViewport({ scale: 1 })

            if (i === 0) {
              const sizeX = (viewport.width * printUnits) / styleUnits
              const sizeY = (viewport.height * printUnits) / styleUnits
              addPrintStyles(iframe, sizeX, sizeY)
            }

            const canvas = document.createElement('canvas')
            canvas.width = viewport.width * printUnits
            canvas.height = viewport.height * printUnits
            container.appendChild(canvas)
            const canvasClone = canvas.cloneNode()
            iframe.contentWindow.document.body.appendChild(canvasClone)

            await page.render({
              canvasContext: canvas.getContext('2d'),
              intent: 'print',
              transform: [printUnits, 0, 0, printUnits, 0, 0],
              viewport,
            }).promise

            canvasClone.getContext('2d').drawImage(canvas, 0, 0)
          })
        )

        if (filename) {
          title = window.document.title
          window.document.title = filename
        }

        iframe.contentWindow.focus()
        iframe.contentWindow.print()
      } catch (e) {
        this.$emit('printing-failed', e)
      } finally {
        if (title) {
          window.document.title = title
        }

        releaseChildCanvases(container)
        container.parentNode?.removeChild(container)
      }
    },
    /**
     * Renders the PDF document as SVG element(s) and additional layers.
     *
     * NOTE: Ignored if the document is not loaded.
     */
    async render() {
      if (!this.document) {
        return
      }

      try {
        this.pageNums = this.page
          ? [this.page]
          : this.showPages > this.pageCount
          ? [...Array(this.pageCount + 1).keys()].slice(1)
          : [...Array(this.showPages + 1).keys()].slice(1)
        await Promise.all(
          this.pageNums.map(async (pageNum, i) => {
            if (this.renderedPages.includes(pageNum) && !this.onePage) {
              return
            }
            this.renderedPages.push(pageNum)
            const page = await this.document.getPage(pageNum)
            const [canvas, div1, div2] =
              this.$el.children[i].children[0].children[0].children
            const [actualWidth, actualHeight] = this.getPageDimensions(
              page,
              page.view[3] / page.view[2]
            )
            if ((this.rotation / 90) % 2) {
              canvas.style.width = `${Math.floor(actualHeight)}px`
              canvas.style.height = `${Math.floor(actualWidth)}px`
            } else {
              canvas.style.width = `${Math.floor(actualWidth)}px`
              canvas.style.height = `${Math.floor(actualHeight)}px`
            }
            await this.renderPage(page, canvas, actualWidth)
            if (!this.disableTextLayer) {
              await this.renderPageTextLayer(page, div1, actualWidth)
            }
            if (!this.disableAnnotationLayer) {
              await this.renderPageAnnotationLayer(
                page,
                div2 || div1,
                actualWidth
              )
            }
          })
        )

        this.$emit('rendered')
      } catch (e) {
        this.document = null
        this.pageCount = null
        this.pageNums = []
        this.$emit('rendering-failed', e)
      }
    },
    /**
     * Renders the page content.
     * @param {PDFPageProxy} page - Page proxy.
     * @param {HTMLCanvasElement} canvas - HTML canvas.
     * @param {number} width - Actual page width.
     */
    async renderPage(page, canvas, width) {
      const viewport = page.getViewport({
        scale: this.scale ?? Math.ceil(width / page.view[2]) + 1,
        rotation: this.rotation,
      })

      canvas.width = viewport.width
      canvas.height = viewport.height
      this.renderedPageSize.push({
        width: canvas.style.width,
        height: canvas.style.height,
      })
      await page.render({
        canvasContext: canvas.getContext('2d'),
        viewport,
      }).promise
    },
    /**
     * Renders the annotation layer for the specified page.
     * @param {PDFPageProxy} page - Page proxy.
     * @param {HTMLElement} container - HTML container.
     * @param {number} width - Actual page width.
     */
    async renderPageAnnotationLayer(page, container, width) {
      emptyElement(container)
      pdf.AnnotationLayer.render({
        annotations: await page.getAnnotations(),
        div: container,
        linkService: this.linkService,
        page,
        renderInteractiveForms: false,
        viewport: page
          .getViewport({
            scale: width / page.view[2],
            rotation: this.rotation,
          })
          .clone({
            dontFlip: true,
          }),
        imageResourcesPath: this.imageResourcesPath,
      })
    },
    /**
     * Renders the text layer for the specified page.
     * @param {PDFPageProxy} page - Page proxy.
     * @param {HTMLElement} container - HTML container.
     * @param {number} width - Actual page width.
     */
    async renderPageTextLayer(page, container, width) {
      emptyElement(container)
      await pdf.renderTextLayer({
        container,
        textContent: await page.getTextContent(),
        viewport: page.getViewport({
          scale: width / page.view[2],
          rotation: this.rotation,
        }),
      }).promise
    },
  },
}
</script>

<style>
@import 'styles/text-layer';
@import 'styles/annotation-layer';

.neo-pdf-viewer > div {
  position: relative;
}

.neo-pdf-viewer > canvas {
  display: block;
}
</style>
