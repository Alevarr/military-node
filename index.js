const config = require("config");
const cors = require("cors");
const express = require("express");
const Pool = require("pg").Pool;

const app = express();
const pool = new Pool({
  user: config.get("user"),
  host: config.get("host"),
  database: config.get("database"),
  password: config.get("password"),
  port: config.get("db_port"),
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("<h1>Api is running!</h1>");
});

app.get("/api/users", (req, res) => {
  pool.query("SELECT * FROM users ORDER BY id ASC", (error, results) => {
    if (error) {
      throw error;
    }
    res.send(results.rows);
  });
});

app.get("/api/citizens", (req, res) => {
  pool.query(
    "SELECT citizens.id, citizens.first_name, citizens.middle_name, citizens.last_name, citizens.passport, personal_files.feasibility_category, personal_files.deferment_end_date FROM citizens JOIN personal_files ON citizens.personal_file_id = personal_files.id;",
    (error, results) => {
      if (error) {
        throw error;
      }
      res.send(results.rows);
    }
  );
});

const port = process.env.PORT || config.get("port");
const server = app.listen(port, () =>
  console.log(`Listening on port ${port}...`)
);

module.exports = server;
