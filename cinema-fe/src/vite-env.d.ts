/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// <ion-icon> is a custom element registered globally by the ionicons script
// loaded in index.html — not a real DOM/React element, so JSX doesn't know it.
declare namespace JSX {
  interface IntrinsicElements {
    'ion-icon': any;
  }
}

// @types/react-slick pulls in a conflicting @types/react version (targets React 19,
// project is on React 18), so it fails to typecheck as a JSX component — use an
// untyped ambient declaration instead.
declare module 'react-slick';
