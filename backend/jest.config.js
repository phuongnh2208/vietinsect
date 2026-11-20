module.exports = {
  testEnvironment: "node",
  globalSetup: "<rootDir>/tests/setup/globalSetup.js",
  globalTeardown: "<rootDir>/tests/setup/globalTeardown.js",
  testMatch: ["**/tests/**/*.test.js"],
  testPathIgnorePatterns: ["/node_modules/", "tests/integration/api\\.smoke\\.test\\.js"],
};
