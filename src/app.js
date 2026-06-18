import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import errorHandler from './middleware/error-handler.js';
import { sendSuccess } from './utils/response.js';

const app = express();

// ----- Security & utility middleware -----
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging (dev format)
app.use(morgan('dev'));

// ----- Health check -----
app.get('/health', (_req, res) => {
  sendSuccess(res, { status: 'ok', timestamp: new Date().toISOString() });
});

// ----- API routes (mounted later per layer) -----
// import routes from './routes/index.js';
// app.use('/api/v1', routes);

// ----- Centralized error handler (must be last) -----
app.use(errorHandler);

export default app;
