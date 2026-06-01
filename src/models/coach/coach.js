import mongoose from 'mongoose';

const registerCoachSchema = new mongoose.Schema({
  yearsOfExperience: {
    type: Number,
    required: true,
    min: 0
  }, 
  userId : { 
   type : String, 
   required : true, 
   unique: true
  },
  certification: {
    type: [String],
    default: []
  },
  specialities: {
    type: [String], 
    default: []
  },
  preferredSessionDuration: {
    type: String,
    required: true
  },
  bio: {
    type: String,
    required: true
  },
  languages: {
    type: [String], 
    default: []
  }
}, {
  timestamps: true
});

const RegisterCoach = mongoose.model('RegisterCoach', registerCoachSchema);

export default RegisterCoach;
