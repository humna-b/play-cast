import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cors from 'cors';

import connectDB from './src/Connection/DBconnect.js'; 

import { clerkWebhook } from './src/routes/userRoute.js';
import { registerCoach } from './src/routes/coach.js';
import { setRole } from './src/routes/setRole.js';
import { tournament } from './src/routes/tournaments.js';
import { deepseek } from './src/routes/games.js';
import { session } from './src/routes/session.js';

dotenv.config();
connectDB();

const app = express();

// Middleware
app.use(cors({ origin: '*' }));

app.use(express.json());
app.use('/api/webhook/clerk', clerkWebhook);

// Health check route
app.get('/', (req, res) => {
  const state = mongoose.connection.readyState;
  const statusMap = {
    0: '🔴 Disconnected',
    1: '🟢 Connected',
    2: '🟡 Connecting',
    3: '🟠 Disconnecting'
  };
  res.send(`Server is running!<br>MongoDB status: <strong>${statusMap[state]}</strong>`);
});

// Routes
app.use('/api', setRole);
app.use('/api', tournament);
app.use('/api', registerCoach);
app.use('/api', deepseek);
app.use('/api', session);
app.use('/api', clerkWebhook);

// Local development server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// ✅ Export the handler for Vercel
export default app;
