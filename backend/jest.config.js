module.exports = {
  testEnvironment: "node",
  globalSetup: "<rootDir>/tests/setup/globalSetup.js",
  globalTeardown: "<rootDir>/tests/setup/globalTeardown.js",
  testMatch: ["**/tests/**/*.test.js"],
  testPathIgnorePatterns: ["/node_modules/", "tests/integration/api\\.smoke\\.test\\.js"],
  collectCoverageFrom: ["src/modules/**/*.service.js"],
  coverageThreshold: {
    global: {
      statements: 70,
      lines: 70,
    },
  },
};
