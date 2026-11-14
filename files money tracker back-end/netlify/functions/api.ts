import { createHandler } from 'serverless-http';
import app from '../../app/src/index';

export const handler = createHandler(app);