
import Session from '../models/session/session.js';
import User from '../models/user/user.js';  
import { sendSessionInviteToCoach } from './mailer.js';
import RegisterCoach from '../models/coach/coach.js';
import { Router } from 'express'; 
const router = Router();

router.post('/create-session', async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const {
      clerkId,
      coachId,
      invitedMembers,
      sessionName,
      sessionStartTime,
      sessionEndTime
    } = req.body;

    if (!clerkId || !coachId || !invitedMembers || !sessionName || !sessionStartTime || !sessionEndTime) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const startTime = new Date(sessionStartTime);
    const endTime = new Date(sessionEndTime);
    const allStudentIds = [...new Set([clerkId, ...invitedMembers])];

    // Fetch coach info
    const coach = await User.findOne({ clerkId: coachId });
    if (!coach) return res.status(404).json({ message: 'Coach not found' });

    // Fetch all sessions the coach is already invited to
    const existingSessions = await Session.find({
      _id: { $in: coach.invitedSessionsAsCoach },
      sessionCoach: coachId,
    });

    // Check for time conflicts
    const conflictSession = existingSessions.find(existing => {
      const existingStart = new Date(existing.sessionStartTime);
      const existingEnd = new Date(existing.sessionEndTime);
      return (
        (startTime < existingEnd && endTime > existingStart) // Overlap logic
      );
    });

    if (conflictSession) {
      return res.status(409).json({
        message: `Coach ${coach.firstName} ${coach.lastName} is already registered to another appointment on this date.`,
      });
    }

    // Create the session
    const newSession = await Session.create({
      sessionName,
      sessionCoach: coachId,
      students: allStudentIds,
      sessionStartTime: startTime,
      sessionEndTime: endTime, 
      accepted: false, 
      rejected : false,
      totalParticipants: allStudentIds.length,
    });

    const sessionId = newSession._id.toString();

    // Update students
    await User.updateMany(
      { clerkId: { $in: invitedMembers } },
      { $addToSet: { invitedSessions: sessionId } }
    );

    // Creator
    await User.updateOne(
      { clerkId },
      { $addToSet: { createdSessions: sessionId } }
    );

    // Coach
    await User.updateOne(
      { clerkId: coachId },
      { $addToSet: { invitedSessionsAsCoach: sessionId } }
    );
    // Fetch creator for email details
const creator = await User.findOne({ clerkId }).select('firstName lastName');

// Send email to coach
await sendSessionInviteToCoach(coach, {
  sessionName,
  sessionStartTime,
  sessionEndTime,
}, `${creator?.firstName || 'Someone'} ${creator?.lastName || ''}`);

    return res.status(201).json({
      message: 'Session created successfully',
      session: newSession,
    });
  } catch (error) {
    console.error('Error creating session:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}); 
router.get('/sessions/coach', async (req, res) => {
  const { coachId } = req.query;

  if (!coachId) {
    return res.status(400).json({ message: 'Missing coachId in query' });
  }

  try {
    const allSessions = await Session.find({ sessionCoach: coachId });
    const now = new Date();

    const past = [];
    const ongoing = [];
    const upcoming = [];

    for (const session of allSessions) {
      const start = new Date(session.sessionStartTime);
      const end = new Date(session.sessionEndTime);

      const isAcceptedOrRejected = session.accepted === true || session.rejected === true;

      if (end < now) {
        past.push(session);
      } else if (start <= now && end >= now) {
        if (isAcceptedOrRejected) {
          ongoing.push(session);
        } else {
          past.push(session); // Ongoing but neither accepted nor rejected
        }
      } else if (start > now) {
        upcoming.push(session);
      }
    }

    return res.status(200).json({
      pastSessions: past,
      ongoingSessions: ongoing,
      upcomingSessions: upcoming,
    });

  } catch (error) {
    console.error('Error fetching coach sessions:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}); 



router.get('/sessions/user', async (req, res) => {
  const { clerkId } = req.query;

  if (!clerkId) {
    return res.status(400).json({ message: 'Missing clerkId in query' });
  }

  try {
    const user = await User.findOne({ clerkId });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const allSessions = await Session.find({ students: clerkId });
    const createdSessions = await Session.find({ _id: { $in: user.createdSessions || [] } });

    const now = new Date();

    const past = [];
    const ongoing = [];
    const upcoming = [];

    for (const session of allSessions) {
      // skip if user created this session
      if (user.createdSessions?.includes(session._id.toString())) continue;

      const start = new Date(session.sessionStartTime);
      const end = new Date(session.sessionEndTime);

      const isAcceptedOrRejected = session.accepted === true || session.rejected === true;

      // Fetch coach details
      const coachData = await User.findOne({ clerkId: session.sessionCoach });
      const sessionWithCoach = { ...session.toObject(), sessionCoach: coachData };

      if (end < now) {
        past.push(sessionWithCoach);
      } else if (start <= now && end >= now) {
        if (isAcceptedOrRejected) {
          ongoing.push(sessionWithCoach);
        } else {
          past.push(sessionWithCoach); // treat as past if not responded
        }
      } else if (start > now) {
        upcoming.push(sessionWithCoach);
      }
    }

    // Add coach data to created sessions
    const createdWithCoach = await Promise.all(
      createdSessions.map(async (session) => {
        const coach = await User.findOne({ clerkId: session.sessionCoach });
        return { ...session.toObject(), sessionCoach: coach };
      })
    );

    return res.status(200).json({
      pastSessions: past,
      ongoingSessions: ongoing,
      upcomingSessions: upcoming,
      createdSessions: createdWithCoach,
    });

  } catch (error) {
    console.error('Error fetching user sessions:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}); 
router.get('/sessions/coach/:coachId', async (req, res) => {
  const { coachId } = req.params;

  if (!coachId) {
    return res.status(400).json({ message: 'Missing coachId in params' });
  }

  try {
    const allSessions = await Session.find({ sessionCoach: coachId });

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setUTCHours(0, 0, 0, 0);
    startOfWeek.setUTCDate(now.getUTCDate() - now.getUTCDay()); // Sunday

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6); // Saturday
    endOfWeek.setUTCHours(23, 59, 59, 999);

    let pastSessions = 0;
    let upcomingSessions = 0;
    let ongoingSessions = 0;
    let sessionsThisWeek = 0;

    for (const session of allSessions) {
      const start = new Date(session.sessionStartTime);
      const end = new Date(session.sessionEndTime);

      // This week
      if (start >= startOfWeek && start <= endOfWeek) {
        sessionsThisWeek++;
      }

      // Past sessions
      if (end < now) {
        pastSessions++;
      }
      // Ongoing sessions (must be accepted)
      else if (start <= now && end >= now && session.accepted === true) {
        ongoingSessions++;
      }
      // Upcoming sessions
      else if (start > now) {
        upcomingSessions++;
      }
    }

    return res.status(200).json({
      pastSessions,
      upcomingSessions,
      ongoingSessions,
      sessionsThisWeek,
    });
  } catch (error) {
    console.error('Error fetching coach sessions:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});



router.get('/coach-profile', async (req, res) => {
  try {
    const { coachId } = req.query;

    if (!coachId) {
      return res.status(400).json({ message: 'Missing coachId (clerkId)' });
    }

    // Fetch coach profile by userId
    const coachProfile = await RegisterCoach.findOne({ userId: coachId });
    if (!coachProfile) {
      return res.status(404).json({ message: 'Coach profile not found' });
    }

    // Fetch user details
    const user = await User.findOne({ clerkId: coachId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Construct combined response
    const response = {
      ...coachProfile._doc,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profileImageUrl: user.profileImageUrl
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching coach profile:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.put('/coach-profile/edit', async (req, res) => {
  try {
    const { coachId, updates } = req.body;

    if (!coachId || !updates || typeof updates !== 'object') {
      return res.status(400).json({ message: 'Missing or invalid coachId or updates' });
    }

    const coach = await RegisterCoach.findOneAndUpdate(
      { userId: coachId },
      { $set: updates },
      { new: true }
    );

    if (!coach) {
      return res.status(404).json({ message: 'Coach profile not found' });
    }

    res.status(200).json({ message: 'Coach profile updated successfully', coachProfile: coach });
  } catch (error) {
    console.error('Error updating coach profile:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


router.post('/approve-session', async (req, res) => {
  try {
    const { clerkId, sessionId } = req.body;

    if (!clerkId || !sessionId) {
      return res.status(400).json({ message: 'Missing clerkId or sessionId' });
    }

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (session.accepted) {
      return res.status(400).json({
        message: `Session "${session.sessionName}" has already been approved.`,
      });
    }

    if (session.rejected) {
      return res.status(400).json({
        message: `Session "${session.sessionName}" has already been rejected.`,
      });
    }

    session.accepted = true;
    session.rejected = false;
    session.totalParticipants += 1;
    await session.save();

    return res.status(200).json({ message: 'Session approved successfully' });
  } catch (error) {
    console.error('Error approving session:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/reject-session', async (req, res) => {
  try {
    const { clerkId, sessionId } = req.body;

    if (!clerkId || !sessionId) {
      return res.status(400).json({ message: 'Missing clerkId or sessionId' });
    }

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (session.rejected) {
      return res.status(400).json({
        message: `Session "${session.sessionName}" has already been rejected.`,
      });
    }

    if (session.accepted) {
      return res.status(400).json({
        message: `Session "${session.sessionName}" has already been approved.`,
      });
    }

    session.accepted = false;
    session.rejected = true;
    await session.save();

    return res.status(200).json({ message: 'Session rejected successfully' });
  } catch (error) {
    console.error('Error rejecting session:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});



export const session = router;
