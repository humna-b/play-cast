import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  sessionName: {
    type: String,
    required: true,
  },
  sessionCoach: {
    type: String, 
    required: true,
  },
  students: {
    type: [String], 
    default: [],
  },
  sessionStartTime: {
    type: Date,
    required: true,
  },
  sessionEndTime: {
    type: Date,
    required: true,
  },
  totalParticipants: {
    type: Number,
    required: false,
  }, 
  accepted : { 
    type : Boolean, 
    required : false,
  }, 
   rejected : { 
    type : Boolean, 
    required : false,
  }
}, {
  timestamps: true,
});

const Session =  mongoose.model('Session', SessionSchema);
export default Session;
