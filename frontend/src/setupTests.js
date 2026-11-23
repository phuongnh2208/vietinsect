// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import fs from 'fs';
import path from 'path';
import i18n from './i18n';

const localesDir = path.resolve(__dirname, '../public/locales');
try {
  const viJson = JSON.parse(fs.readFileSync(path.join(localesDir, 'vi.json'), 'utf8'));
  const enJson = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
  i18n.addResourceBundle('vi', 'translation', viJson, true, true);
  i18n.addResourceBundle('en', 'translation', enJson, true, true);
} catch {
  // Ignore if locales files are unavailable in isolated test runs
}

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
      createRadialGradient: () => ({ addColorStop: () => {} }),
      getImageData: (_x, _y, w = 1, h = 1) => ({
        data: new Uint8ClampedArray(Math.max(1, w) * Math.max(1, h) * 4),
      }),
      putImageData: () => {},
    };
  };
}
