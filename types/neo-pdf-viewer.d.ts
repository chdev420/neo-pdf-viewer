import { ComputedOptions, DefineComponent, MethodOptions } from 'vue';

export interface NeoPdfViewerProps {
  disableAnnotationLayer?: boolean;
  disableTextLayer?: boolean;
  height?: number | string;
  imageResourcesPath?: string;
  page?: number;
  rotation?: number | string;
  source: object | string | URL | Uint8Array;
  width?: number | string;
}

export interface NeoPdfViewerData {
  document: object | null;
  pageCount: number | null;
  pageNums: number[];
}

export interface NeoPdfViewerMethods extends MethodOptions {
  print: (dpi?: number, filename?: string, allPages?: boolean) => Promise<void>;
  render: () => Promise<void>;
}

declare const NeoPdfViewer: DefineComponent<
  NeoPdfViewerProps,
  {},
  NeoPdfViewerData,
  ComputedOptions,
  NeoPdfViewerMethods
>;

export default NeoPdfViewer;
