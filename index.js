const config = require("config");
const express = require("express");
const Pool = require('pg').Pool

const app = express();
const pool = new Pool({
  user: config.get('user'),
  host: config.get('host'),
  database: config.get('database'),
  password: config.get('password'),
  port: config.get('db_port'),
})

console.log(pool)

app.use(express.json());

app.get("/", (req, res) => {
    res.send("<h1>Api is running!</h1>");
  });

app.get('/api/users', (req, res) => {
    pool.query('SELECT * FROM users ORDER BY id ASC', (error, results) => {
        if (error) {
        throw error
        }
        res.status(200).json(results.rows)
    })
})

const port = process.env.PORT || config.get("port");
const server = app.listen(port, () =>
  console.log(`Listening on port ${port}...`)
);

module.exports = server;
