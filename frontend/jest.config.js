module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.{js,jsx}'],
  verbose: true,
  testTimeout: 15000,

  // Code coverage configuration
  collectCoverageFrom: [
    'context/**/*.js',
    'hooks/**/*.js',
    'utils/**/*.js',
    'pages/**/*.js',
    '!pages/_app.js',
    '!pages/_document.js',
    '!node_modules/**',
    '!__tests__/**',
    '!coverage/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'clover', 'json', 'json-summary'],
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>/coverage',
        outputName: 'junit.xml',
      },
    ],
  ],

  // Handle CSS imports and static files
  moduleNameMapper: {
    '\\.(css|less|sass|scss)$': '<rootDir>/__tests__/__mocks__/styleMock.js',
    '\\.(gif|ttf|eot|svg|png|jpg|jpeg)$': '<rootDir>/__tests__/__mocks__/fileMock.js',
  },

  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest']
  },
};
