import express from 'express';
import Tournament from '../models/tournament/tournament.js'; 
import mongoose from 'mongoose'; 
import { sendEmail } from './mailer.js';
import User from '../models/user/user.js'; 

const router = express.Router();  

router.get('/get/availableFriends', async (req, res) => {
  try {
    const { userId, startTime, endTime } = req.query;

    if (!userId || !startTime || !endTime) {
      return res.status(400).json({ message: 'userId, startTime, and endTime are required' });
    }

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const queryStart = new Date(startTime);
    const queryEnd = new Date(endTime);

    const friends = await User.find({ clerkId: { $in: user.friends } });

    const availableFriends = [];

    for (const friend of friends) {
      const hasConflict = await Tournament.exists({
        $or: [
          { members: friend.clerkId },
          { invitedUsers: friend.clerkId }, 
          { createdBy: friend.clerkId },    
        ],
        startDate: { $lt: queryEnd },
        endDate: { $gt: queryStart },
      });

      if (!hasConflict) {
        availableFriends.push(friend);
      }
    }

    res.status(200).json({ availableFriends });

  } catch (error) {
    console.error('Error checking available friends:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}); 
router.get('/get/availableFriendsForSession', async (req, res) => {
  try {
    const { userId, startTime, endTime } = req.query;

    if (!userId || !startTime || !endTime) {
      return res.status(400).json({ message: 'userId, startTime, and endTime are required' });
    }

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const queryStart = new Date(startTime);
    const queryEnd = new Date(endTime);

    const friends = await User.find({
      clerkId: { $in: user.friends },
      isCoach: false, // 👈 Only non-coach friends
    });

    const availableFriends = [];

    for (const friend of friends) {
      const hasConflict = await Tournament.exists({
        $or: [
          { members: friend.clerkId },
          { invitedUsers: friend.clerkId },
          { createdBy: friend.clerkId },
        ],
        startDate: { $lt: queryEnd },
        endDate: { $gt: queryStart },
      });

      if (!hasConflict) {
        availableFriends.push(friend);
      }
    }

    res.status(200).json({ availableFriends });

  } catch (error) {
    console.error('Error checking available friends for session:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/create/tournament', async (req, res) => {
  try {
    let {
      tournamentName,
      maxPlayers,
      location,
      startDate,
      endDate,
      sport,
      members,
      userId
    } = req.body;

    if (!Array.isArray(members)) {
      members = [];
    }

    if (!tournamentName || !maxPlayers || !location || !startDate || !endDate || !sport || !userId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const newStart = new Date(startDate);
    const newEnd = new Date(endDate);

    const user = await User.findOne({ clerkId: userId }).select('createdTournaments invitedTournaments');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const createdIds = user.createdTournaments.map(t => t._id);
    const invitedIds = user.invitedTournaments.map(t => t._id);
    const allTournamentIds = [...createdIds, ...invitedIds];

    const allTournaments = await Tournament.find({ _id: { $in: allTournamentIds } });

    const conflict = allTournaments.some(tournament => {
      const tStart = new Date(tournament.startDate);
      const tEnd = new Date(tournament.endDate);
      return tStart < newEnd && tEnd > newStart;
    });

    if (conflict) {
      return res.status(409).json({ message: 'You have a conflicting tournament in this time range' });
    }

    const tournament = new Tournament({
      userId,
      tournamentName,
      maxPlayers,
      location,
      startDate: newStart,
      endDate: newEnd,
      sport,
      members,
    });

    await tournament.save();

    // Store only tournament ID in createdTournaments
    await User.findOneAndUpdate(
      { clerkId: userId },
      { $push: { createdTournaments: { _id: tournament._id } } }
    );

    // Store only tournament ID in invitedTournaments for each member
    if (members.length > 0) {
      await User.updateMany(
        { clerkId: { $in: members } },
        { $push: { invitedTournaments: { _id: tournament._id } } }
      );
    } 
    // Send invitation emails
const invitedUsers = await User.find({ clerkId: { $in: members } }).select('email firstName');

for (const invitedUser of invitedUsers) {
  const emailHTML = `
    <h2>Hello ${invitedUser.name || 'Player'},</h2>
    <p>You have been invited to participate in the tournament <strong>${tournamentName}</strong>!</p>
    <ul>
      <li><strong>Sport:</strong> ${sport}</li>
      <li><strong>Location:</strong> ${location}</li>
      <li><strong>Start Date:</strong> ${newStart.toDateString()}</li>
      <li><strong>End Date:</strong> ${newEnd.toDateString()}</li>
    </ul>
    <p>Click below to view and manage your tournaments:</p>
    <a href="https://your-domain.com/dashboard/event-management" target="_blank" style="background-color:#007bff;color:#fff;padding:10px 15px;text-decoration:none;border-radius:5px;">View Invitations</a>
    <br/><br/>
    <p>Best regards,<br/>Weather Sportify Team</p>
  `;

  await sendEmail(invitedUser.email, `You're invited to ${tournamentName}!`, emailHTML);
}


    res.status(201).json({ message: 'Tournament created successfully', tournament });

  } catch (error) {
    console.error('Error creating tournament:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
router.get('/get/tournaments', async (req, res) => {
  try {
    const { clerkId } = req.query;

    if (!clerkId) {
      return res.status(400).json({ message: 'clerkId is required' });
    }

    const user = await User.findOne({ clerkId }).select('createdTournaments invitedTournaments');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Extract only the _id values from the subdocuments
    const createdIds = user.createdTournaments.map(t => t._id);
    const invitedIds = user.invitedTournaments.map(t => t._id);

    // Fetch full tournament objects from the Tournament collection
    const [createdTournaments, invitedTournaments] = await Promise.all([
      Tournament.find({ _id: { $in: createdIds } }),
      Tournament.find({ _id: { $in: invitedIds } })
    ]);

    res.status(200).json({
      createdTournaments,
      invitedTournaments
    });

  } catch (error) {
    console.error('Error fetching tournaments:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
router.put('/edit/tournament/:tournamentId', async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const {
      tournamentName,
      maxPlayers,
      location,
      startDate,
      endDate,
      sport,
      members,
      userId,
    } = req.body;

    if (!tournamentId || !userId) {
      return res.status(400).json({ message: 'tournamentId and userId are required' });
    }

    const newStart = new Date(startDate);
    const newEnd = new Date(endDate);

    // Find user
    const user = await User.findOne({ clerkId: userId }).select('createdTournaments invitedTournaments');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    } 

    const allIds = [
      ...user.createdTournaments.map(t => t._id),
      ...user.invitedTournaments.map(t => t._id),
    ];

    const tournaments = await Tournament.find({ _id: { $in: allIds } });

    // Check for conflict (excluding the current one)
    const conflict = tournaments.some(t => {
      if (t._id.toString() === tournamentId) return false;
      const tStart = new Date(t.startDate);
      const tEnd = new Date(t.endDate);
      return tStart < newEnd && tEnd > newStart;
    });

    if (conflict) {
      return res.status(409).json({ message: 'You have a conflicting tournament in this time range' });
    }

    // Update tournament
    const updatedTournament = await Tournament.findByIdAndUpdate(
      tournamentId,
      {
        tournamentName,
        maxPlayers,
        location,
        startDate: newStart,
        endDate: newEnd,
        sport,
        members,
      },
      { new: true }
    );

    if (!updatedTournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }
   // Send invitation emails
const invitedUsers = await User.find({ clerkId: { $in: members } }).select('email firstName');

for (const invitedUser of invitedUsers) {
  const emailHTML = `
    <h2>Hello ${invitedUser.name || 'Player'},</h2>
    <p>You have been invited to participate in the tournament <strong>${tournamentName}</strong>!</p>
    <ul>
      <li><strong>Sport:</strong> ${sport}</li>
      <li><strong>Location:</strong> ${location}</li>
      <li><strong>Start Date:</strong> ${newStart.toDateString()}</li>
      <li><strong>End Date:</strong> ${newEnd.toDateString()}</li>
    </ul>
    <p>Click below to view and manage your tournaments:</p>
    <a href="https://your-domain.com/dashboard/event-management" target="_blank" style="background-color:#007bff;color:#fff;padding:10px 15px;text-decoration:none;border-radius:5px;">View Invitations</a>
    <br/><br/>
    <p>Best regards,<br/>Weather Sportify Team</p>
  `;

  await sendEmail(invitedUser.email, `You're invited to ${tournamentName}!`, emailHTML);
}

    res.status(200).json({ message: 'Tournament updated successfully', tournament: updatedTournament });

  } catch (error) {
    console.error('Error editing tournament:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
router.delete('/delete/tournament/:tournamentId', async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { userId } = req.query;

    if (!tournamentId || !userId) {
      return res.status(400).json({ message: 'tournamentId and userId are required' });
    }

    const tournament = await Tournament.findById(tournamentId);

    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    if (tournament.userId !== userId) {
      return res.status(403).json({ message: 'You are not the creator of this tournament' });
    }

    await Tournament.findByIdAndDelete(tournamentId);

    const tournamentObjectId = new mongoose.Types.ObjectId(tournamentId);

    await User.updateOne(
      { clerkId: userId },
      { $pull: { createdTournaments: { _id: tournamentObjectId } } }
    );

    if (Array.isArray(tournament.members) && tournament.members.length > 0) {
      await User.updateMany(
        { clerkId: { $in: tournament.members } },
        { $pull: { invitedTournaments: { _id: tournamentObjectId } } }
      );
    }

    res.status(200).json({ message: 'Tournament deleted successfully' });

  } catch (error) {
    console.error('Error deleting tournament:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});




export const tournament = router;
