
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const tournamentSchema = new Schema(
  { 
    userId : { 
      type : String, 
      required : true, 
      trim:true
    },
    tournamentName: {
      type: String,
      required: true,
      trim: true,
    },
    maxPlayers: {
      type: Number,
      required: true,
      min: 1,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    sport: {
      type: String,
      required: true,
      trim: true,
    },
    members: [String],
  },
  {
    timestamps: true,
  }
);

const Tournament = model('Tournament', tournamentSchema);

export default Tournament;
