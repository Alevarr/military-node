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

app.get("/api/citizens/:id", (req, res) => {
  const id = req.params.id;
  pool.query(
    `SELECT  
    citizens.id,
    citizens.first_name,
    citizens.middle_name,
    citizens.last_name,
    citizens.passport,
    ARRAY_AGG(DISTINCT jsonb_build_object('release_date', militaries.release_date, 'military_serial', militaries.military_serial, 'comment', militaries.comment)) AS militaries,
    personal_files.feasibility_category,
    personal_files.deferment_end_date,
    ARRAY_AGG(DISTINCT jsonb_build_object('type', record_history.type, 'date', record_history.date, 'department', jsonb_build_object('name', departments.name, 'address', departments.address))) AS records,
    ARRAY_AGG(DISTINCT jsonb_build_object('id', actions.id, 'type', actions.type, 'user_email', users.email)) AS actions
  FROM  
    citizens
  LEFT JOIN  
    militaries ON citizens.id = militaries.citizen_id
  LEFT JOIN   
  personal_files ON citizens.personal_file_id = personal_files.id
  LEFT JOIN   
    record_history ON personal_files.id = record_history.personal_file_id
  LEFT JOIN   
  departments ON record_history.department_id = departments.id
  LEFT JOIN
  actions ON actions.citizen_id = citizens.id
  LEFT JOIN
  users ON actions.user_id = users.id
  WHERE
    citizens.id = ${id}
  GROUP BY
   citizens.id,
   personal_files.feasibility_category,
   personal_files.deferment_end_date
  
  `,
    (error, results) => {
      if (error) {
        throw error;
      }
      res.send(results.rows[0]);
    }
  );
});

const port = process.env.PORT || config.get("port");
const server = app.listen(port, () =>
  console.log(`Listening on port ${port}...`)
);

module.exports = server;
