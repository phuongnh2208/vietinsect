// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function getContextStub() {
    return {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      save: () => {},
      restore: () => {},
      scale: () => {},
      translate: () => {},
      rotate: () => {},
      clearRect: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      rect: () => {},
      clip: () => {},
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      setLineDash: () => {},
      measureText: () => ({ width: 0 }),
      fillText: () => {},
      drawImage: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
    };
  };
}
