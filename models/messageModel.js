const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  originalName: { type: String, required: true }, // Original file name
  fileName: { type: String, required: true }, // File name in the MinIO bucket
  fileType: { type: String, required: true }, // MIME type of the file
  size: { type: Number, required: true }, // File size in bytes
  uploadDate: { type: Date, default: Date.now }, // Date of upload
});

module.exports = mongoose.model('File', fileSchema);
