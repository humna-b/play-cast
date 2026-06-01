import express from 'express';
import User from '../models/user/user.js';
import { clerkClient } from '@clerk/clerk-sdk-node';

const router = express.Router();

router.post('/set-role', async (req, res) => { 
  console.log('CLERK_SECRET_KEY loaded:', process.env.CLERK_SECRET_KEY);

  const { userId, role } = req.body;

  if (!userId || !role) {
    return res.status(400).json({ message: 'Missing userId or role' });
  }

  try {
    const existingUser = await User.findOne({ clerkId: userId });

    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    existingUser.role = role;
    await existingUser.save();

    await clerkClient.users.updateUser(userId, {
      publicMetadata: {
        role: role,
      },
    });

    return res.status(200).json({ success: true, user: existingUser });
  } catch (err) {
    console.error('Error setting role:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

export const setRole = router;
