import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import './data/seeds'; // auto-populates the in-memory store

export const worker = setupWorker(...handlers);
