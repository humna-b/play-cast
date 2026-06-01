import express from 'express';
import { Webhook } from 'svix';
import { Clerk } from '@clerk/clerk-sdk-node';
import User from '../models/user/user.js';  
import { sendWelcomeEmail } from './mailer.js'; 
import { sendFriendRequestEmail } from './mailer.js';
import dotenv from 'dotenv';

const router = express.Router(); 
dotenv.config();

const clerk = new Clerk({ secretKey: process.env.CLERK_SECRET_KEY }); 

const verifyClerkWebhook = async (req, res, next) => {
  const svix = new Webhook(process.env.CLERK_WEBHOOK_SECRET);

  const payload = req.body;
  const headers = req.headers;

  try {
    const event = svix.verify(JSON.stringify(payload), headers);
    req.clerkEvent = event;
    next();
  } catch (err) {
    console.error('❌ Invalid webhook signature:', err.message);
    return res.status(400).send('Invalid signature');
  }
}; 
router.post(
  '/webhook/clerk',
  express.raw({ type: 'application/json' }), 
  verifyClerkWebhook,
  async (req, res) => {
    try {
      const event = req.clerkEvent;
      console.log('✅ Clerk Webhook HIT:', event.type);

      const userData = event.data;

      if (event.type === 'user.created' || event.type === 'user.updated') {
        const email =
          userData.email_addresses?.find(
            (e) => e.id === userData.primary_email_address_id
          )?.email_address || '';

        let isCoach = userData.public_metadata?.isCoach;

        if (typeof isCoach === 'undefined') {
          await clerk.users.updateUser(userData.id, {
            publicMetadata: {
              ...userData.public_metadata,
              isCoach: 'false',
            },
          });
          isCoach = 'false';
        }
        await User.findOneAndUpdate(
  { clerkId: userData.id },
  {
    clerkId: userData.id,
    email,
    firstName: userData.first_name || '',
    lastName: userData.last_name || '',
    profileImageUrl: userData.profile_image_url || '',
    username: userData.username || '',
    isCoach,
    bio: '',
    achievements: userData.public_metadata?.achievements || [],
    friendRequests: userData.public_metadata?.friendRequests || [],
    friends: userData.public_metadata?.friends || [],
    sentRequests: userData.public_metadata?.sentRequests || [],

    createdTournaments: [],
    invitedTournaments: [],
    coaches: [],  
    acceptedSessions : [], 
    rejectedSessions : [],  
    createdSessions: [],
    invitedSessions: [],
  },
  { upsert: true, new: true }
);

      } else if (event.type === 'user.deleted') {
        await User.deleteOne({ clerkId: userData.id });
      }

      return res.sendStatus(200);
    } catch (err) {
      console.error('Webhook handler error:', err);
      return res.status(500).send('Server error');
    }
  }
);


router.post('/update-profile', async (req, res) => {
  const { clerkId, bio, achievements } = req.body;

  console.log('Incoming data:', { clerkId, bio, achievements });

  if (
    !clerkId ||
    typeof clerkId !== 'string' ||
    typeof bio !== 'string' ||
    !Array.isArray(achievements) ||
    !achievements.every(
      a =>
        a &&
        typeof a.name === 'string' &&
        typeof a.icon === 'string' &&
        typeof a.color === 'string'
    )
  ) {
    return res.status(400).json({ message: 'Invalid input' });
  }

  try {
    const userBefore = await User.findOne({ clerkId });
    console.log('Before update:', userBefore);

    const updatedUser = await User.findOneAndUpdate(
      { clerkId },
      {
        $set: {
          bio,
          achievements,
        },
      },
      { new: true, runValidators: true }
    );

    console.log('After update:', updatedUser);

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    await clerk.users.updateUser(clerkId, {
      publicMetadata: {
        ...updatedUser.publicMetadata,
        bio,
        achievements,
      },
    });

    return res
      .status(200)
      .json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (err) {
    console.error('Error updating profile:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});
router.get('/user/relationships/:clerkId', async (req, res) => {
  const { clerkId } = req.params;

  if (!clerkId) {
    return res.status(400).json({ error: 'clerkId is required' });
  }

  try {
    const user = await User.findOne({ clerkId });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [friendRequests, sentRequests, friends] = await Promise.all([
      User.find({ clerkId: { $in: user.friendRequests } }),
      User.find({ clerkId: { $in: user.sentRequests } }),
      User.find({ clerkId: { $in: user.friends } }),
    ]);

    res.status(200).json({
      friendRequests,
      sentRequests,
      friends,
    });
  } catch (error) {
    console.error('Error fetching relationships:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

 
router.get('/user-info', async (req, res) => {
  const { clerkId } = req.query;

  if (!clerkId) {
    return res.status(400).json({ error: 'clerkId is required' });
  }

  try {
    const user = await User.findOne({ clerkId });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.post('/update-profile', async (req, res) => {
  const { clerkId, bio, achievements } = req.body;
  console.log('Incoming data:', { clerkId, bio, achievements });

  if (!clerkId || typeof bio !== 'string' || !Array.isArray(achievements)) {
    return res.status(400).json({ message: 'Invalid input' });
  }

  try {
    const userBefore = await User.findOne({ clerkId });
    console.log('Before update:', userBefore);

    const updatedUser = await User.findOneAndUpdate(
      { clerkId },
      { $set: { bio, achievements } },
      { new: true, runValidators: true }
    );

    console.log('After update:', updatedUser);

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    await clerk.users.updateUser(clerkId, {
      publicMetadata: {
        ...updatedUser.publicMetadata,
        bio,
        achievements,
      },
    });

    return res.status(200).json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (err) {
    console.error('Error updating profile:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});


router.get('/friend-suggestions', async (req, res) => {
  const { clerkId } = req.query;

  if (!clerkId) {
    return res.status(400).json({ error: 'clerkId is required' });
  }

  try {
    const currentUser = await User.findOne({ clerkId }).select('friends friendRequests sentRequests');

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const excludeClerkIds = new Set([
      clerkId,
      ...currentUser.friends,
      ...currentUser.friendRequests,
      ...currentUser.sentRequests,
    ]);

    const suggestions = await User.aggregate([
      {
        $match: {
          clerkId: { $nin: Array.from(excludeClerkIds) },
        }
      },
      { $sample: { size: 6 } } // Random 6 users
    ]);

    res.status(200).json(suggestions);

  } catch (error) {
    console.error('Error fetching friend suggestions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/search-users', async (req, res) => {
  const { clerkId, letters } = req.query;

  if (!clerkId || !letters || typeof clerkId !== 'string' || typeof letters !== 'string') {
    return res.status(400).json({ message: 'Missing or invalid query parameters' });
  }

  try {
    const users = await User.find({
      clerkId: { $ne: clerkId }, 
      $or: [
        { firstName: { $regex: letters, $options: 'i' } },
        { lastName: { $regex: letters, $options: 'i' } },
      ],
    })
      .limit(10)

    return res.status(200).json({ users });
  } catch (err) {
    console.error('Error searching users:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});




router.post('/send-friend-request', async (req, res) => {
  const { fromClerkId, toClerkId } = req.body;

  if (!fromClerkId || !toClerkId) {
    return res.status(400).json({ error: 'Both fromClerkId and toClerkId are required' });
  }

  if (fromClerkId === toClerkId) {
    return res.status(400).json({ error: 'Cannot send a friend request to yourself' });
  }

  try {
    const sender = await User.findOne({ clerkId: fromClerkId });
    const receiver = await User.findOne({ clerkId: toClerkId });

    if (!sender || !receiver) {
      return res.status(404).json({ error: 'Sender or receiver not found' });
    }

    const alreadyFriends = sender.friends.includes(toClerkId);
    if (alreadyFriends) {
      return res.status(400).json({ error: 'This user is already in your friends list' });
    }

    const alreadyRequested = receiver.friendRequests.includes(fromClerkId);
    if (alreadyRequested) {
      return res.status(400).json({ error: 'Friend request already sent' });
    }

    const alreadyInSent = sender.sentRequests.includes(toClerkId);
    if (alreadyInSent) {
      return res.status(400).json({ error: 'You already sent a friend request to this user' });
    }
      await sendFriendRequestEmail(receiver.email, receiver.firstName, sender.firstName);

    // Push only clerkIds
    receiver.friendRequests.push(fromClerkId);
    sender.sentRequests.push(toClerkId);
     
    await receiver.save();
    await sender.save();

    res.status(200).json({ message: 'Friend request sent successfully' });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.post('/cancel-friend-request', async (req, res) => {
  const { fromClerkId, toClerkId } = req.body;

  if (!fromClerkId || !toClerkId) {
    return res.status(400).json({ error: 'Both fromClerkId and toClerkId are required' });
  }

  try {
    const sender = await User.findOne({ clerkId: fromClerkId });
    const receiver = await User.findOne({ clerkId: toClerkId });

    if (!sender || !receiver) {
      return res.status(404).json({ error: 'Sender or receiver not found' });
    }

    sender.sentRequests = sender.sentRequests.filter(id => id !== toClerkId);
    receiver.friendRequests = receiver.friendRequests.filter(id => id !== fromClerkId);

    await sender.save();
    await receiver.save();

    res.status(200).json({ message: 'Friend request canceled successfully' });
  } catch (error) {
    console.error('Error canceling friend request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/delete-friend-request', async (req, res) => {
  const { fromClerkId, toClerkId } = req.body;

  if (!fromClerkId || !toClerkId) {
    return res.status(400).json({ error: 'Both fromClerkId and toClerkId are required' });
  }

  try {
    const receiver = await User.findOne({ clerkId: toClerkId });
    const sender = await User.findOne({ clerkId: fromClerkId });

    if (!sender || !receiver) {
      return res.status(404).json({ error: 'Sender or receiver not found' });
    }

    receiver.friendRequests = receiver.friendRequests.filter(id => id !== fromClerkId);
    sender.sentRequests = sender.sentRequests.filter(id => id !== toClerkId);

    await sender.save();
    await receiver.save();

    res.status(200).json({ message: 'Friend request deleted successfully' });
  } catch (error) {
    console.error('Error deleting friend request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/accept-friend-request', async (req, res) => {
  const { fromClerkId, toClerkId } = req.body;

  if (!fromClerkId || !toClerkId) {
    return res.status(400).json({ error: 'Both fromClerkId and toClerkId are required' });
  }

  try {
    const receiver = await User.findOne({ clerkId: toClerkId });
    const sender = await User.findOne({ clerkId: fromClerkId });

    if (!sender || !receiver) {
      return res.status(404).json({ error: 'Sender or receiver not found' });
    }

    const requestExists = receiver.friendRequests.includes(fromClerkId);
    if (!requestExists) {
      return res.status(400).json({ error: 'No friend request to accept' });
    }

    if (!receiver.friends.includes(fromClerkId)) {
      receiver.friends.push(fromClerkId);
    }

    if (!sender.friends.includes(toClerkId)) {
      sender.friends.push(toClerkId);
    }

    receiver.friendRequests = receiver.friendRequests.filter(id => id !== fromClerkId);
    sender.sentRequests = sender.sentRequests.filter(id => id !== toClerkId);

    await receiver.save();
    await sender.save();

    res.status(200).json({ message: 'Friend request accepted successfully' });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/unfriend', async (req, res) => {
  const { userClerkId, targetClerkId } = req.body;

  if (!userClerkId || !targetClerkId) {
    return res.status(400).json({ error: 'Both userClerkId and targetClerkId are required' });
  }

  try {
    const user = await User.findOne({ clerkId: userClerkId });
    const target = await User.findOne({ clerkId: targetClerkId });

    if (!user || !target) {
      return res.status(404).json({ error: 'User or target not found' });
    }

    const areFriends = user.friends.some(friend => friend.clerkId === targetClerkId);
    if (!areFriends) {
      return res.status(400).json({ error: 'Users are not friends' });
    }

    user.friends = user.friends.filter(friend => friend.clerkId !== targetClerkId);
    target.friends = target.friends.filter(friend => friend.clerkId !== userClerkId);

    await user.save();
    await target.save();

    res.status(200).json({ message: 'Unfriended successfully' });
  } catch (error) {
    console.error('Error unfriending:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});





export const clerkWebhook = router;
