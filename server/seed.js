const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load project root .env first (helps when .env is at repo root), then server/.env
const rootEnv = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}
dotenv.config();

const Channel = require('./models/Channel');
const Admin = require('./models/Admin');
const bcrypt = require('bcrypt');

const MONGO = process.env.MONGO_URI;
if (!MONGO) {
  console.error('MONGO_URI not set in .env - cannot run seed.');
  process.exit(1);
}

mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected to Mongo, seeding...');

    // create admin (kept for compatibility - not required)
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'changeme';
    let admin = await Admin.findOne({ username });
    if (!admin) {
      const hash = await bcrypt.hash(password, 10);
      admin = await Admin.create({ username, passwordHash: hash });
      console.log('Created admin', username);
    } else {
      console.log('Admin exists');
    }

    // reset channels and add example channels aligned with simplified model
    await Channel.deleteMany({});
    const channels = [
      {
        name: 'Music',
        playlistStartEpoch: new Date('2020-01-01T00:00:00Z'),
        items: [
          { title: 'YouTube Demo', youtubeId: 'M7lc1UVf-VE', duration: 30, year: 2000, tags: ['demo'] },
          { title: 'Sample Clip', youtubeId: 'K4TOrB7at0Y', duration: 45, year: 2005, tags: ['sample'] }
        ]
      },
      {
        name: 'Trailers',
        playlistStartEpoch: new Date('2020-01-01T00:00:00Z'),
        items: [
          { title: 'Big Clip', youtubeId: 'dQw4w9WgXcQ', duration: 60, year: 2010, tags: ['movie'] }
        ]
      },
      {
        name: 'Cartoons',
        playlistStartEpoch: new Date('2020-01-01T00:00:00Z'),
        items: [
          { title: 'Kid Clip', youtubeId: '3JZ_D3ELwOQ', duration: 50, year: 2012, tags: ['kids'] }
        ]
      }
    ];

    await Channel.insertMany(channels);
    console.log('Inserted sample channels');
    process.exit(0);
  })
  .catch(err => { console.error('Seed error', err); process.exit(1); });
