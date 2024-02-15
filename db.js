const config = require("config");
const Pool = require("pg").Pool;

const pool = new Pool({
    user: config.get("user"),
    host: config.get("host"),
    database: config.get("database"),
    password: config.get("password"),
    port: config.get("db_port"),
});

  module.exports = pool