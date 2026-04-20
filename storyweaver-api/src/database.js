'use strict';

const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

const isLocal = process.env.DEPLOY_MODE === 'localhost';

let sequelize;

if (isLocal) {
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(dataDir, 'bl-drama.sqlite'),
    logging: false,
  });
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'bl_drama',
    process.env.DB_USER || 'root',
    process.env.DB_PASS || '',
    {
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3306,
      dialect: 'mysql',
      timezone: '+08:00',
      logging: false,
      dialectOptions: { dateStrings: true, typeCast: true },
      define: { charset: 'utf8mb4' },
    }
  );
}

module.exports = sequelize;
