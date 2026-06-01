import express from 'express';
import axios from 'axios';

const router = express.Router();

const MODEL_ID = "deepseek/deepseek-chat"; 
const API_KEY = process.env.OPENROUTER_API_KEY;

function parseGames(content) {
  const entries = content.split('\n\n');

  const games = entries.map(entry => {
    const titleLine = entry.match(/TITLE\d+:\s*(.*)/);
    const descLine = entry.match(/DESCRIPTION\d+:\s*(.*)/);

    return {
      title: titleLine ? titleLine[1].trim() : '',
      description: descLine ? descLine[1].trim() : ''
    };
  });

  return games;
}




router.post('/games-suggestions', async (req, res) => {
  const weatherData = req.body;

  try {
    // Mock response for development - returns game recommendations based on weather
    const mockRecommendations = [
      {
        title: "Basketball",
        description: "Great for outdoor play. Good cardiovascular exercise and teamwork building."
      },
      {
        title: "Tennis",
        description: "Excellent sport for agility and reaction time. Can be played in pairs or groups."
      },
      {
        title: "Volleyball",
        description: "Fun team sport that improves coordination and communication skills."
      },
      {
        title: "Badminton",
        description: "Lightweight sport perfect for quick reflexes and strategic gameplay."
      },
      {
        title: "Soccer",
        description: "Popular team sport that combines speed, endurance, and tactical thinking."
      }
    ];

    res.json({ recommendations: mockRecommendations });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

export const deepseek =  router;
