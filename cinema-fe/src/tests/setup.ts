import '@testing-library/jest-dom';

// jsdom doesn't implement scrollIntoView at all; TimeInput/DateInput call it to keep the
// active option visible when their dropdown opens.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom doesn't implement matchMedia; react-slick (used by the home page sliders) needs it.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
