import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  clerkId: String,
  email: String,
  firstName: String,
  lastName: String,
  role: { type: String, enum: ['user', 'coach', 'admin'], default: "user" },
  profileImageUrl: String,
  isCoach: {
    type: String,
    enum: ['true', 'false', 'blocked'],
    default: 'false'
  },
  bio: { type: String, default: '' },
  achievements: {
    type: [{ icon: String, name: String, color: String }],
    default: [],
  },
  friendRequests: {
    type: [Object], default: []
  },
  sentRequests: { type: [Object], default: [] },
  friends: { type: [Object], default: [] },
  createdTournaments: { type: [Object], default: [] },
  invitedTournaments: { type: [Object], default: [] },
 coaches: {
  type: [
    {
      coachId: { type: String, required: true },
      sessionId: { type: String, required: true }
    }
  ],
  default: [],
},
invitedSessions: {
    type: [String],
    default: [],
  },
 
  createdSessions : { 
    type: [String],
    default: [],
  }, 
 
  invitedSessionsAsCoach: {
    type: [String],
    default: [],
  },
});

const User = mongoose.model('User', UserSchema);
export default User;
