import express from 'express';
import User from '../models/user/user.js';

const router = express.Router();

// Frontend calls this once after login.
// If the user doesn't exist in our database yet, create them.
// If they already exist, do nothing (just return them).
router.post('/sync-user', async (req, res) => {
  try {
    const { clerkId, email, firstName, lastName, profileImageUrl } = req.body;

    if (!clerkId) {
      return res.status(400).json({ message: 'clerkId is required' });
    }

    // upsert: create if missing, otherwise leave existing data alone
    const user = await User.findOneAndUpdate(
      { clerkId },
      {
        $setOnInsert: {
          clerkId,
          email: email || '',
          firstName: firstName || '',
          lastName: lastName || '',
          profileImageUrl: profileImageUrl || '',
          isCoach: 'false',
          bio: '',
          achievements: [],
          friendRequests: [],
          sentRequests: [],
          friends: [],
          createdTournaments: [],
          invitedTournaments: [],
          coaches: [],
          invitedSessions: [],
          createdSessions: [],
          invitedSessionsAsCoach: [],
        },
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({ message: 'User synced', user });
  } catch (error) {
    console.error('Error syncing user:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export const syncUser = router