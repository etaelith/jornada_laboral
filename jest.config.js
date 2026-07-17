module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  collectCoverageFrom: ['src/domain/**/*.{ts,tsx}', 'src/application/**/*.{ts,tsx}'],
};
