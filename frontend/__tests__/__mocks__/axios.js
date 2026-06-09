// Mock for axios
const mockAxios = {
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  put: jest.fn(() => Promise.resolve({ data: {} })),
  delete: jest.fn(() => Promise.resolve({ data: {} })),
  defaults: {
    headers: {
      common: {},
    },
  },
};

module.exports = {
  ...mockAxios,
  default: mockAxios,
  create: jest.fn(() => mockAxios),
};
