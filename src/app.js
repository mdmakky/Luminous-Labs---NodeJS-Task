import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { swaggerDocument } from './config/swagger.js';
import errorHandler from './middleware/error-handler.js';
import { sendSuccess } from './utils/response.js';

const app = express();

// Trust the first proxy hop — required for express-rate-limit to read X-Forwarded-For correctly
app.set('trust proxy', 1);

// ----- Security & utility middleware -----
// Disable CSP to allow inline assets required by Swagger UI
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging (dev format)
app.use(morgan('dev'));

// ----- Swagger Documentation -----
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ----- Welcome and Health check -----
app.get('/', (_req, res) => {
  sendSuccess(res, {
    message: 'Welcome to the Task Assignment API',
    version: '1.0.0',
    docs: '/api-docs',
    health: '/health',
  });
});

app.get('/health', (_req, res) => {
  sendSuccess(res, { status: 'ok', timestamp: new Date().toISOString() });
});

// ----- API routes -----
import routes from './routes/index.js';
app.use('/api/v1', routes);

// ----- Centralized error handler (must be last) -----
app.use(errorHandler);

export default app;
