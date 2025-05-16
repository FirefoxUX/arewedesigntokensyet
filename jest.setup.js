import { jest } from '@jest/globals';

global.jest = jest;

console.log = jest.fn();
