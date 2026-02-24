import fs from 'fs';
try {
  if (fs.existsSync('eslint.config.js')) {
    fs.unlinkSync('eslint.config.js');
    console.log('Successfully deleted eslint.config.js');
  } else {
    console.log('eslint.config.js not found');
  }
} catch (err) {
  console.error('Error deleting file:', err);
}
