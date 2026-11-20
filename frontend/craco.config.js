const path = require('path');

module.exports = {
  eslint: {
    enable: false,
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  jest: {
    configure: {
      moduleNameMapper: {
        '^react-leaflet$': '<rootDir>/src/__mocks__/react-leaflet.js',
        '^leaflet/dist/leaflet\\.css$': '<rootDir>/src/__mocks__/styleMock.js',
      },
    },
  },
};