<template>
  <div>
    <vue-pdf-embed
      :image-resources-path="annotationIconsPath"
      :source="pdfSource"
      :show-pages="5"
    />
  </div>
</template>

<script>
import VuePdfEmbed from '../src/vue-pdf-embed.vue'
import { json } from './text'
export default {
  components: {
    VuePdfEmbed,
  },
  data() {
    return {
      annotationIconsPath: '/node_modules/pdfjs-dist/web/images/',
      pdfSource: json,
    }
  },
}
</script>

<style lang="scss">
body {
  padding: 16px;
  background-color: #ccc;
}

.vue-pdf-embed {
  margin: auto;
  max-width: fit-content;

  & > div {
    margin-bottom: 4px;
    box-shadow: 0 2px 8px 4px rgba(0, 0, 0, 0.1);
  }
}
</style>
